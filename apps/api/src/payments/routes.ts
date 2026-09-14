import { Hono } from "hono";
import { db } from "../db/client.js";
import { requireAuth } from "../auth/middleware.js";
import { checkPaymentStatus } from "./service.js";

export const paymentRoutes = new Hono();

type Row = Record<string, unknown>;

async function logEvent(orderId: string, stage: string, note: string, actorId: string) {
  await db.execute({
    sql: "INSERT INTO order_events (id, order_id, stage, note, actor_id) VALUES (?, ?, ?, ?, ?)",
    args: [`evt_${Math.random().toString(36).slice(2)}`, orderId, stage, note, actorId],
  });
}

/**
 * Poll a payment's status against the mobile money provider (mock or live
 * Yo! Payments). Sandbox/mock testing has no public webhook target, so the
 * client polls this instead of relying solely on /payments/yo/callback.
 */
paymentRoutes.get("/payments/:id/refresh", requireAuth, async (c) => {
  const id = c.req.param("id") as string;
  const user = c.get("user");
  const res = await db.execute({ sql: "SELECT * FROM payments WHERE id = ?", args: [id] });
  const payment = res.rows[0] as Row | undefined;
  if (!payment) return c.json({ error: "not_found" }, 404);

  const orderRes = await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [payment.order_id as string] });
  const order = orderRes.rows[0] as Row | undefined;
  if (!order) return c.json({ error: "order_not_found" }, 404);
  if (order.customer_id !== user.sub && order.rider_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }

  if (payment.status !== "pending") {
    return c.json({ payment });
  }

  try {
    const status = await checkPaymentStatus({
      provider: payment.provider as string,
      provider_ref: payment.provider_ref as string | null,
      created_at: payment.created_at as string,
    });

    if (status === "successful") {
      await db.execute({
        sql: "UPDATE payments SET status = 'successful', updated_at = datetime('now') WHERE id = ?",
        args: [id],
      });
      if (payment.type === "collection" && order.stage === "Fund") {
        await db.execute({
          sql: "UPDATE orders SET stage = 'Shop', updated_at = datetime('now') WHERE id = ?",
          args: [order.id as string],
        });
        await logEvent(order.id as string, "Shop", "Escrow funded — shopping started", user.sub);
      }
    } else if (status === "failed") {
      await db.execute({
        sql: "UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
        args: [id],
      });
    }

    const updated = await db.execute({ sql: "SELECT * FROM payments WHERE id = ?", args: [id] });
    return c.json({ payment: updated.rows[0] });
  } catch (err) {
    return c.json({ error: "payment_status_check_failed", message: String(err) }, 502);
  }
});

/** Real Yo! Payments webhook target (requires YO_CALLBACK_URL to be a public HTTPS endpoint). */
paymentRoutes.post("/payments/yo/callback", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  console.log("Yo! Payments callback received:", JSON.stringify(body));
  return c.json({ received: true });
});
