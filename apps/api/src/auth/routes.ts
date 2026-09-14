import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { createAndSendOtp } from "../verify/service.js";
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
