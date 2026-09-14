import { Hono } from "hono";
import { z } from "zod";
import type { InArgs } from "@libsql/client";
import { db } from "../db/client.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { isMomoConfigured } from "../momo/client.js";
import { getR2Bucket } from "../storage/r2.js";

export const adminRoutes = new Hono();
adminRoutes.use("*", requireAuth, requireRole("admin"));

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Platform overview
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/stats", async (c) => {
  const [users, riders, ordersByStage, paymentsByStatus, settled] = await Promise.all([
    db.execute(
      `SELECT role, COUNT(*) as n FROM users WHERE role IN ('customer', 'rider') GROUP BY role`,
    ),
    db.execute(
      `SELECT
         SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified,
         SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online
       FROM riders`,
    ),
    db.execute(`SELECT stage, COUNT(*) as n FROM orders GROUP BY stage`),
    db.execute(`SELECT status, COUNT(*) as n FROM payments GROUP BY status`),
    db.execute(`SELECT COALESCE(SUM(final_total), 0) as total FROM orders WHERE stage = 'Settle'`),
  ]);

  const usersByRole: Record<string, number> = { customer: 0, rider: 0 };
  for (const row of users.rows as Row[]) {
    usersByRole[row.role as string] = row.n as number;
  }
  const riderCounts = (riders.rows[0] as Row) ?? { verified: 0, online: 0 };
  const stageCounts: Record<string, number> = {};
  for (const row of ordersByStage.rows as Row[]) {
    stageCounts[row.stage as string] = row.n as number;
  }
  const paymentCounts: Record<string, number> = { pending: 0, successful: 0, failed: 0 };
  for (const row of paymentsByStatus.rows as Row[]) {
    paymentCounts[row.status as string] = row.n as number;
  }

  return c.json({
    stats: {
      totalCustomers: usersByRole.customer ?? 0,
      totalRiders: usersByRole.rider ?? 0,
      verifiedRiders: Number(riderCounts.verified ?? 0),
      onlineRiders: Number(riderCounts.online ?? 0),
      ordersByStage: stageCounts,
      paymentsByStatus: paymentCounts,
      settledGmv: Number((settled.rows[0] as Row)?.total ?? 0),
    },
  });
});

adminRoutes.get("/admin/integrations", async (c) => {
  let storageConfigured = true;
  try {
    getR2Bucket();
  } catch {
    storageConfigured = false;
  }

  const failed = await db.execute(
    `SELECT id, order_id, type, amount, currency, msisdn, created_at
     FROM payments WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10`,
  );

  return c.json({
    integrations: {
      momo: {
        configured: isMomoConfigured(),
        targetEnv: process.env.MOMO_TARGET_ENV ?? "sandbox",
        baseUrl: process.env.MOMO_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com",
      },
      storage: { configured: storageConfigured },
    },
    recentFailedPayments: failed.rows,
  });
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/customers", async (c) => {
  const q = c.req.query("q")?.trim();
  const res = await db.execute(
    q
      ? {
          sql: `SELECT u.id, u.name, u.phone, u.email, u.status, u.created_at,
                  (SELECT COUNT(*) FROM orders WHERE customer_id = u.id) as order_count
                FROM users u WHERE u.role = 'customer' AND (u.name LIKE ? OR u.phone LIKE ?)
                ORDER BY u.created_at DESC LIMIT 100`,
          args: [`%${q}%`, `%${q}%`],
        }
      : `SELECT u.id, u.name, u.phone, u.email, u.status, u.created_at,
           (SELECT COUNT(*) FROM orders WHERE customer_id = u.id) as order_count
         FROM users u WHERE u.role = 'customer' ORDER BY u.created_at DESC LIMIT 100`,
  );
  return c.json({ customers: res.rows });
});

adminRoutes.get("/admin/customers/:id", async (c) => {
  const id = c.req.param("id");
  const userRes = await db.execute({
    sql: `SELECT id, name, phone, email, status, created_at FROM users WHERE id = ? AND role = 'customer'`,
    args: [id],
  });
  const customer = userRes.rows[0];
  if (!customer) return c.json({ error: "not_found" }, 404);

  const ordersRes = await db.execute({
    sql: `SELECT o.*, u.name as rider_name FROM orders o
          LEFT JOIN users u ON u.id = o.rider_id
          WHERE o.customer_id = ? ORDER BY o.updated_at DESC`,
    args: [id],
  });

  return c.json({ customer, orders: ordersRes.rows });
});

// ---------------------------------------------------------------------------
// Orders (platform-wide, read only)
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/orders", async (c) => {
  const stage = c.req.query("stage")?.trim();
  const type = c.req.query("type")?.trim();
  const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? "30") || 30, 100));

  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (stage) {
    conditions.push("o.stage = ?");
    args.push(stage);
  }
  if (type) {
    conditions.push("o.type = ?");
    args.push(type);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  args.push(limit);

  const res = await db.execute({
    sql: `SELECT o.*, c.name as customer_name, r.name as rider_name FROM orders o
          LEFT JOIN users c ON c.id = o.customer_id
          LEFT JOIN users r ON r.id = o.rider_id
          ${where}
          ORDER BY o.updated_at DESC LIMIT ?`,
    args: args as unknown as InArgs,
  });
  return c.json({ orders: res.rows });
});

// ---------------------------------------------------------------------------
// Account status (suspend / reactivate riders or customers)
// ---------------------------------------------------------------------------

const statusSchema = z.object({ status: z.enum(["active", "suspended"]) });

adminRoutes.post("/admin/users/:id/status", async (c) => {
  const id = c.req.param("id");
  const parsed = statusSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const existing = await db.execute({ sql: "SELECT id, role FROM users WHERE id = ?", args: [id] });
  const row = existing.rows[0] as Row | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.role === "admin") {
    return c.json({ error: "cannot_manage_admin", message: "Admin accounts can't be suspended here" }, 400);
  }

  await db.execute({
    sql: "UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [parsed.data.status, id],
  });
  const res = await db.execute({
    sql: "SELECT id, name, phone, email, role, status FROM users WHERE id = ?",
    args: [id],
  });
  return c.json({ user: res.rows[0] });
});
