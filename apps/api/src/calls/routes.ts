import { Hono } from "hono";
import { db } from "../db/client.js";
import { verifyToken } from "../auth/jwt.js";

export const callRoutes = new Hono();

type DurableObjectStub = { fetch(request: Request): Promise<Response> };
type DurableObjectNamespace = { idFromName(name: string): unknown; get(id: unknown): DurableObjectStub };

/**
 * WebSocket signaling endpoint for in-app voice calls between a customer and
 * their rider. Cloudflare Workers only (needs the CALL_ROOM Durable Object
 * binding, which doesn't exist under plain Node/local dev).
 *
 * Auth can't use the usual Bearer header — browsers can't set arbitrary
 * headers on a WebSocket handshake — so the JWT travels as a query param
 * instead. It's short-lived enough (signaling only, closed at hangup) that
 * this is an acceptable tradeoff over the header-based auth used everywhere
 * else in this API.
 */
callRoutes.get("/orders/:id/call", async (c) => {
  const orderId = c.req.param("id");
  const token = c.req.query("token");
  if (!token) return c.json({ error: "unauthorized", message: "Missing token" }, 401);

  let userId: string;
  try {
    const payload = await verifyToken(token);
    userId = payload.sub;
  } catch {
    return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
  }

  const res = await db.execute({ sql: "SELECT customer_id, rider_id FROM orders WHERE id = ?", args: [orderId] });
  const order = res.rows[0] as { customer_id?: string; rider_id?: string } | undefined;
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.customer_id !== userId && order.rider_id !== userId) {
    return c.json({ error: "forbidden" }, 403);
  }

  const env = c.env as { CALL_ROOM?: DurableObjectNamespace } | undefined;
  const namespace = env?.CALL_ROOM;
  if (!namespace) {
    return c.json(
      { error: "calls_not_supported", message: "Live calls require the Cloudflare Worker deployment." },
      501,
    );
  }

  const id = namespace.idFromName(orderId);
  const stub = namespace.get(id);
  return stub.fetch(c.req.raw);
});
