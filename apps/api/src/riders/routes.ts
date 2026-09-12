import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

export const riderRoutes = new Hono();

const applySchema = z.object({
  area: z.string().max(120).optional(),
  vehicleInfo: z.string().max(120).optional(),
  momoMsisdn: z.string().min(6).max(20).optional(),
});

/** Rider self-registers/updates their profile. Verification stays manual (mock admin approval). */
riderRoutes.post("/riders/apply", requireAuth, requireRole("rider"), async (c) => {
  const user = c.get("user");
  const parsed = applySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  await db.execute({
    sql: `INSERT INTO riders (user_id, area, vehicle_info, momo_msisdn)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            area = excluded.area,
            vehicle_info = excluded.vehicle_info,
            momo_msisdn = excluded.momo_msisdn,
            updated_at = datetime('now')`,
    args: [user.sub, parsed.data.area ?? null, parsed.data.vehicleInfo ?? null, parsed.data.momoMsisdn ?? null],
  });

  const res = await db.execute({ sql: "SELECT * FROM riders WHERE user_id = ?", args: [user.sub] });
  return c.json({ rider: res.rows[0] });
});

const statusSchema = z.object({ online: z.boolean() });

riderRoutes.post("/riders/status", requireAuth, requireRole("rider"), async (c) => {
  const user = c.get("user");
  const parsed = statusSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  await db.execute({
    sql: "UPDATE riders SET is_online = ?, updated_at = datetime('now') WHERE user_id = ?",
    args: [parsed.data.online ? 1 : 0, user.sub],
  });
  const res = await db.execute({ sql: "SELECT * FROM riders WHERE user_id = ?", args: [user.sub] });
  if (res.rows.length === 0) return c.json({ error: "not_a_rider" }, 404);
  return c.json({ rider: res.rows[0] });
});

riderRoutes.get("/riders/me", requireAuth, requireRole("rider"), async (c) => {
  const user = c.get("user");
  const res = await db.execute({ sql: "SELECT * FROM riders WHERE user_id = ?", args: [user.sub] });
  return c.json({ rider: res.rows[0] ?? null });
});

/** Rider's own assigned orders (any stage before Settle). */
riderRoutes.get("/riders/me/orders", requireAuth, requireRole("rider"), async (c) => {
  const user = c.get("user");
  const res = await db.execute({
    sql: "SELECT * FROM orders WHERE rider_id = ? ORDER BY updated_at DESC",
    args: [user.sub],
  });
  return c.json({ orders: res.rows });
});

// ---------------------------------------------------------------------------
// Admin — mock manual KYC/verification (no real document/ID provider yet)
// ---------------------------------------------------------------------------

riderRoutes.get("/admin/riders", requireAuth, requireRole("admin"), async (c) => {
  const res = await db.execute(
    `SELECT u.id, u.name, u.phone, r.verified, r.is_online, r.area, r.vehicle_info, r.rating, r.momo_msisdn
     FROM riders r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC`,
  );
  return c.json({ riders: res.rows });
});

const verifySchema = z.object({ verified: z.boolean() });

riderRoutes.post("/admin/riders/:userId/verify", requireAuth, requireRole("admin"), async (c) => {
  const userId = c.req.param("userId") as string;
  const parsed = verifySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const result = await db.execute({
    sql: "UPDATE riders SET verified = ?, updated_at = datetime('now') WHERE user_id = ?",
    args: [parsed.data.verified ? 1 : 0, userId],
  });
  if (result.rowsAffected === 0) return c.json({ error: "not_found" }, 404);

  const res = await db.execute({ sql: "SELECT * FROM riders WHERE user_id = ?", args: [userId] });
  return c.json({ rider: res.rows[0] });
});
