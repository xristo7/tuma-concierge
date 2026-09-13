import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { requireAuth } from "../auth/middleware.js";
import { newId } from "../lib/ids.js";

export const locationRoutes = new Hono();
locationRoutes.use("*", requireAuth);

/** Saved delivery locations (e.g. "Home", "Office") a customer can reuse
 * when placing shopping or parcel orders instead of typing an address each time. */
locationRoutes.get("/locations", async (c) => {
  const user = c.get("user");
  const res = await db.execute({
    sql: "SELECT * FROM saved_locations WHERE user_id = ? ORDER BY created_at ASC",
    args: [user.sub],
  });
  return c.json({ locations: res.rows });
});

const saveLocationSchema = z.object({
  label: z.string().min(1).max(60),
  area: z.string().max(120).optional(),
  address: z.string().max(240).optional(),
});

locationRoutes.post("/locations", async (c) => {
  const user = c.get("user");
  const parsed = saveLocationSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const id = newId("loc");
  await db.execute({
    sql: "INSERT INTO saved_locations (id, user_id, label, area, address) VALUES (?, ?, ?, ?, ?)",
    args: [id, user.sub, parsed.data.label, parsed.data.area ?? null, parsed.data.address ?? null],
  });
  const res = await db.execute({ sql: "SELECT * FROM saved_locations WHERE id = ?", args: [id] });
  return c.json({ location: res.rows[0] }, 201);
});

locationRoutes.delete("/locations/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await db.execute({ sql: "SELECT user_id FROM saved_locations WHERE id = ?", args: [id] });
  const row = existing.rows[0] as { user_id?: string } | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.user_id !== user.sub) return c.json({ error: "forbidden" }, 403);
  await db.execute({ sql: "DELETE FROM saved_locations WHERE id = ?", args: [id] });
  return c.json({ ok: true });
});
