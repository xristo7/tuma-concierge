/**
 * Saved mobile money numbers — up to 2 per (account, purpose). 'payment' is
 * for a customer funding an order or topping up their wallet; 'withdrawal'
 * is for a rider (and, once it exists, a restaurant) cashing out. Generic
 * on the signed-in account rather than role-specific, since a restaurant
 * owner is itself a customer-role account (see ../restaurants/routes.ts)
 * and would otherwise collide with its own payment numbers.
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";

export const mobileNumberRoutes = new Hono();
mobileNumberRoutes.use("*", requireAuth);

type Row = Record<string, unknown>;

const MAX_PER_PURPOSE = 2;
const purposeSchema = z.enum(["payment", "withdrawal"]);
const phoneSchema = z.string().min(6).max(20);

mobileNumberRoutes.get("/mobile-numbers", async (c) => {
  const user = c.get("user");
  const purpose = purposeSchema.safeParse(c.req.query("purpose"));
  if (!purpose.success) return c.json({ error: "invalid_purpose" }, 400);

  const res = await db.execute({
    sql: "SELECT * FROM saved_mobile_numbers WHERE owner_id = ? AND purpose = ? ORDER BY is_primary DESC, created_at ASC",
    args: [user.sub, purpose.data],
  });
  return c.json({ numbers: res.rows });
});

const createSchema = z.object({
  purpose: purposeSchema,
  phone: phoneSchema,
  label: z.string().max(40).optional(),
  isPrimary: z.boolean().optional(),
});

mobileNumberRoutes.post("/mobile-numbers", async (c) => {
  const user = c.get("user");
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  const existing = await db.execute({
    sql: "SELECT id FROM saved_mobile_numbers WHERE owner_id = ? AND purpose = ?",
    args: [user.sub, d.purpose],
  });
  if (existing.rows.length >= MAX_PER_PURPOSE) {
    return c.json({ error: "limit_reached", message: `You can save up to ${MAX_PER_PURPOSE} numbers` }, 409);
  }
  // The first number for a purpose is always primary, whether or not the
  // caller asked — there's no meaningful "non-primary only" state.
  const makePrimary = d.isPrimary || existing.rows.length === 0;

  const id = newId("mno");
  try {
    if (makePrimary) {
      await db.execute({
        sql: "UPDATE saved_mobile_numbers SET is_primary = 0, updated_at = datetime('now') WHERE owner_id = ? AND purpose = ?",
        args: [user.sub, d.purpose],
      });
    }
    await db.execute({
      sql: "INSERT INTO saved_mobile_numbers (id, owner_id, purpose, phone, label, is_primary) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, user.sub, d.purpose, d.phone, d.label ?? null, makePrimary ? 1 : 0],
    });
  } catch {
    return c.json({ error: "duplicate_number", message: "That number is already saved" }, 409);
  }

  const res = await db.execute({ sql: "SELECT * FROM saved_mobile_numbers WHERE id = ?", args: [id] });
  return c.json({ number: res.rows[0] }, 201);
});

const updateSchema = z.object({
  phone: phoneSchema.optional(),
  label: z.string().max(40).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

mobileNumberRoutes.patch("/mobile-numbers/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  const existing = await db.execute({ sql: "SELECT * FROM saved_mobile_numbers WHERE id = ?", args: [id] });
  const row = existing.rows[0] as Row | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.owner_id !== user.sub) return c.json({ error: "forbidden" }, 403);

  if (d.isPrimary) {
    await db.execute({
      sql: "UPDATE saved_mobile_numbers SET is_primary = 0, updated_at = datetime('now') WHERE owner_id = ? AND purpose = ?",
      args: [user.sub, row.purpose as string],
    });
  }

  const fields: Record<string, unknown> = {};
  if (d.phone != null) fields.phone = d.phone;
  if (d.label !== undefined) fields.label = d.label;
  if (d.isPrimary != null) fields.is_primary = d.isPrimary ? 1 : 0;

  const keys = Object.keys(fields);
  if (keys.length > 0) {
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    try {
      await db.execute({
        sql: `UPDATE saved_mobile_numbers SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
        args: [...keys.map((k) => fields[k]), id] as never,
      });
    } catch {
      return c.json({ error: "duplicate_number", message: "That number is already saved" }, 409);
    }
  }

  const res = await db.execute({ sql: "SELECT * FROM saved_mobile_numbers WHERE id = ?", args: [id] });
  return c.json({ number: res.rows[0] });
});

mobileNumberRoutes.delete("/mobile-numbers/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await db.execute({ sql: "SELECT * FROM saved_mobile_numbers WHERE id = ?", args: [id] });
  const row = existing.rows[0] as Row | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.owner_id !== user.sub) return c.json({ error: "forbidden" }, 403);

  await db.execute({ sql: "DELETE FROM saved_mobile_numbers WHERE id = ?", args: [id] });

  // Deleting the primary promotes whichever one's left, so a purpose with
  // any saved numbers always has exactly one primary.
  if (row.is_primary) {
    const remaining = await db.execute({
      sql: "SELECT id FROM saved_mobile_numbers WHERE owner_id = ? AND purpose = ? ORDER BY created_at ASC LIMIT 1",
      args: [user.sub, row.purpose as string],
    });
    const next = remaining.rows[0] as Row | undefined;
    if (next) {
      await db.execute({
        sql: "UPDATE saved_mobile_numbers SET is_primary = 1, updated_at = datetime('now') WHERE id = ?",
        args: [next.id as string],
      });
    }
  }

  return c.json({ ok: true });
});
