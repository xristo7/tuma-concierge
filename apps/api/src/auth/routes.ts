import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { hashCode } from "../verify/otp.js";
import { appBaseUrl, createAndSendOtp, maskTarget } from "../verify/service.js";
import { toAuthUser } from "./serialize.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";

export const authRoutes = new Hono();

const registerSchema = z
  .object({
    phone: z.string().min(6).max(20).optional(),
    email: z.string().email().max(160).optional(),
    name: z.string().min(1).max(80),
    password: z.string().min(6).max(100),
    role: z.enum(["customer", "rider"]).default("customer"),
  })
  .refine((data) => !!data.phone || !!data.email, {
    message: "Provide a phone number or an email address",
    path: ["email"],
  });

const loginSchema = z.object({
  identifier: z.string().min(3).max(160),
  password: z.string().min(1),
});

type UserRow = {
  id: string;
  phone: string | null;
  name: string;
  password_hash: string;
  role: "customer" | "rider" | "admin";
  status: "active" | "suspended";
};

/** Best-effort: a registration should never fail because the OTP send did.
 * Defaults to email when one was given (email is the default identifier for
 * now), falling back to SMS for phone-only signups. */
async function sendInitialOtp(userId: string, phone?: string, email?: string): Promise<string | undefined> {
  const [channel, target] = email ? (["email", email] as const) : (["sms", phone!] as const);
  try {
    const { devCode } = await createAndSendOtp(userId, channel, target);
    return devCode;
  } catch (err) {
    console.error(`Failed to send initial verification ${channel}:`, err);
    return undefined;
  }
}

authRoutes.post("/register", async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  }
  const { phone, email, name, password, role } = parsed.data;

  if (phone) {
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE phone = ?",
      args: [phone],
    });
    if (existing.rows.length > 0) {
      return c.json({ error: "phone_taken", message: "Phone already registered" }, 409);
    }
  }
  if (email) {
    const existingEmail = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    if (existingEmail.rows.length > 0) {
      return c.json({ error: "email_taken", message: "Email already registered" }, 409);
    }
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  await db.execute({
    sql: "INSERT INTO users (id, phone, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, phone ?? null, email ?? null, name, passwordHash, role],
  });

  if (role === "rider") {
    await db.execute({
      sql: "INSERT INTO riders (user_id, verified, is_online) VALUES (?, 0, 0)",
      args: [id],
    });
  }

  const devCode = await sendInitialOtp(id, phone, email);

  const token = await signToken({ sub: id, role, phone });
  const userRow = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return c.json(
    {
      token,
      user: toAuthUser(userRow.rows[0]),
      ...(role === "rider"
        ? { riderStatus: "pending_verification" as const }
        : {}),
      ...(devCode ? { verifyDevCode: devCode } : {}),
    },
    201,
  );
});

authRoutes.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  }
  const { identifier, password } = parsed.data;

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE phone = ? OR email = ?",
    args: [identifier, identifier],
  });
  const row = result.rows[0] as unknown as (UserRow & Record<string, unknown>) | undefined;
  if (!row) {
    return c.json({ error: "invalid_credentials" }, 401);
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    return c.json({ error: "invalid_credentials" }, 401);
  }
  if (row.status === "suspended") {
    return c.json({ error: "account_suspended", message: "This account has been suspended" }, 403);
  }

  const token = await signToken({ sub: row.id, role: row.role, phone: row.phone });
  return c.json({
    token,
    user: toAuthUser(row),
  });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [user.sub],
  });
  const row = result.rows[0];
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ user: toAuthUser(row) });
});

// ---------------------------------------------------------------------------
// One-click email verification — the confirmation link sent by
// createAndSendOtp() (see apps/api/src/verify/service.ts) points here.
// Public: proof of identity is the unguessable token itself, not a session
// — the person clicking may well be on a different device/browser than the
// one they signed up on.
// ---------------------------------------------------------------------------

authRoutes.get("/verify/confirm-link", async (c) => {
  const token = c.req.query("token");
  const fallbackBase = process.env.CUSTOMER_APP_URL ?? "http://localhost:3000";
  if (!token) return c.redirect(`${fallbackBase}/verify/confirmed?ok=0&reason=missing`, 302);

  const tokenHash = await hashCode(token);
  const res = await db.execute({
    sql: `SELECT o.*, u.role as user_role FROM otp_codes o JOIN users u ON u.id = o.user_id
          WHERE o.link_token_hash = ? AND o.purpose = 'verify' AND o.channel = 'email' AND o.consumed_at IS NULL
          LIMIT 1`,
    args: [tokenHash],
  });
  const otp = res.rows[0] as unknown as
    | { id: string; user_id: string; expires_at: string; user_role: string | null }
    | undefined;
  if (!otp) return c.redirect(`${fallbackBase}/verify/confirmed?ok=0&reason=invalid`, 302);

  const base = appBaseUrl(otp.user_role);
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return c.redirect(`${base}/verify/confirmed?ok=0&reason=expired`, 302);
  }

  await db.execute({
    sql: "UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?",
    args: [otp.id],
  });
  await db.execute({
    sql: "UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    args: [otp.user_id],
  });

  return c.redirect(`${base}/verify/confirmed?ok=1`, 302);
});

// ---------------------------------------------------------------------------
// Forgot password — public (the whole point is the user is signed out).
// Reuses the otp_codes table with purpose='reset' so it's short-lived and
// rate-limited the same way onboarding codes are; never reveals whether an
// identifier matches an account.
// ---------------------------------------------------------------------------

const RESET_COOLDOWN_SECONDS = 30;
const RESET_MAX_ATTEMPTS = 5;

function parseSqliteTimestamp(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

const resetRequestSchema = z.object({ identifier: z.string().min(3).max(160) });

authRoutes.post("/password/reset/request", async (c) => {
  const parsed = resetRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { identifier } = parsed.data;

  const result = await db.execute({
    sql: "SELECT id, phone, email FROM users WHERE phone = ? OR email = ?",
    args: [identifier, identifier],
  });
  const row = result.rows[0] as unknown as { id: string; phone: string | null; email: string | null } | undefined;
  // Same response whether or not the account exists — don't let this endpoint
  // be used to enumerate registered phone numbers/emails.
  if (!row) return c.json({ sent: true });

  const channel: "sms" | "email" = row.email ? "email" : "sms";
  const target = (channel === "email" ? row.email : row.phone) as string;

  const recent = await db.execute({
    sql: `SELECT created_at FROM otp_codes WHERE user_id = ? AND purpose = 'reset' ORDER BY created_at DESC LIMIT 1`,
    args: [row.id],
  });
  const lastCreatedAt = recent.rows[0]?.created_at as string | undefined;
  if (lastCreatedAt) {
    const remainingMs = RESET_COOLDOWN_SECONDS * 1000 - (Date.now() - parseSqliteTimestamp(lastCreatedAt).getTime());
    if (remainingMs > 0) return c.json({ sent: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) });
  }

  try {
    const { devCode } = await createAndSendOtp(row.id, channel, target, "reset");
    return c.json({ sent: true, channel, target: maskTarget(channel, target), ...(devCode ? { devCode } : {}) });
  } catch (err) {
    console.error("Failed to send password reset code:", err);
    return c.json({ sent: true });
  }
});

const resetConfirmSchema = z.object({
  identifier: z.string().min(3).max(160),
  code: z.string().length(6),
  newPassword: z.string().min(6).max(100),
});

authRoutes.post("/password/reset/confirm", async (c) => {
  const parsed = resetConfirmSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { identifier, code, newPassword } = parsed.data;

  const result = await db.execute({
    sql: "SELECT id, phone, role, status FROM users WHERE phone = ? OR email = ?",
    args: [identifier, identifier],
  });
  const row = result.rows[0] as unknown as
    | { id: string; phone: string | null; role: string; status: string }
    | undefined;
  if (!row) return c.json({ error: "invalid_code" }, 400);

  const otpRes = await db.execute({
    sql: `SELECT * FROM otp_codes WHERE user_id = ? AND purpose = 'reset' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    args: [row.id],
  });
  const otp = otpRes.rows[0] as unknown as
    | { id: string; code_hash: string; expires_at: string; attempts: number }
    | undefined;
  if (!otp) return c.json({ error: "no_pending_code" }, 400);
  if (new Date(otp.expires_at).getTime() < Date.now()) return c.json({ error: "code_expired" }, 400);
  if (otp.attempts >= RESET_MAX_ATTEMPTS) return c.json({ error: "too_many_attempts" }, 429);

  const codeHash = await hashCode(code);
  if (codeHash !== otp.code_hash) {
    await db.execute({ sql: "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", args: [otp.id] });
    return c.json({ error: "invalid_code" }, 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.execute({
    sql: "UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?",
    args: [otp.id],
  });
  await db.execute({
    sql: "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
    args: [passwordHash, row.id],
  });

  if (row.status === "suspended") {
    return c.json({ error: "account_suspended", message: "This account has been suspended" }, 403);
  }

  const token = await signToken({ sub: row.id, role: row.role as "customer" | "rider" | "admin", phone: row.phone });
  const userRow = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
  return c.json({ token, user: toAuthUser(userRow.rows[0]) });
});
