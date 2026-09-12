import type { Context, Next } from "hono";
import { verifyToken, type AuthTokenPayload } from "./jwt.js";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthTokenPayload;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return c.json({ error: "unauthorized", message: "Missing bearer token" }, 401);
  }
  try {
    const payload = await verifyToken(token);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
  }
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
