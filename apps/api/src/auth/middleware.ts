import type { Context, Next } from "hono";
import { db } from "../db/client.js";
import { verifyToken, type AuthTokenPayload } from "./jwt.js";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthTokenPayload;
  }
}

/** SQLite's `datetime('now')` yields "YYYY-MM-DD HH:MM:SS" — UTC, but with a
 * space instead of "T" and no trailing "Z", so `Date` won't parse it as-is. */
function sqliteSeconds(value: string): number {
  return Math.floor(new Date(`${value.replace(" ", "T")}Z`).getTime() / 1000);
}

/**
 * Verifying the signature only tells us the token was minted by us at some
 * point — not that the account still exists, is still allowed in, or that the
 * session wasn't signed out. One indexed lookup per request buys all three:
 *
 *  - deleted user      → the row is gone, reject
 *  - suspended user    → reject, so suspending someone actually kicks them out
 *  - password reset    → sessions_valid_from moves forward, older tokens die
 *  - explicit sign-out → the token's jti lands in revoked_sessions
 */
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return c.json({ error: "unauthorized", message: "Missing bearer token" }, 401);
  }

  let payload: AuthTokenPayload;
  try {
    payload = await verifyToken(token);
  } catch {
    return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
  }

  const res = await db.execute({
    sql: `SELECT u.status, u.sessions_valid_from,
                 (SELECT 1 FROM revoked_sessions r WHERE r.jti = ?) AS revoked
          FROM users u WHERE u.id = ?`,
    args: [payload.jti, payload.sub],
  });
  const row = res.rows[0] as { status?: string; sessions_valid_from?: string | null; revoked?: number | null } | undefined;

  if (!row) {
    return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
  }
  if (row.revoked) {
    return c.json({ error: "session_ended", message: "You've been signed out. Please log in again." }, 401);
  }
  if (row.status === "suspended") {
    return c.json({ error: "account_suspended", message: "This account has been suspended" }, 403);
  }
  if (row.sessions_valid_from) {
    // Both sides are whole seconds, and a token issued by the same request
    // that moved the cutoff shares its second — so equal has to pass.
    if (payload.iat < sqliteSeconds(row.sessions_valid_from)) {
      return c.json({ error: "session_ended", message: "Please log in again." }, 401);
    }
  }

  c.set("user", payload);
  await next();
}

export function requireRole(...roles: AuthTokenPayload["role"][]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: "forbidden", message: `Requires role: ${roles.join(" or ")}` }, 403);
    }
    await next();
  };
}
