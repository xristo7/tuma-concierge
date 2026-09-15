import { Hono } from "hono";
import { z } from "zod";
import type { InArgs } from "@libsql/client";
import { db } from "../db/client.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { haversineKm } from "../lib/geo.js";
import { newId, newPin } from "../lib/ids.js";
import { getDeliverySettings, getMaxOrderValue } from "../lib/settings.js";
import { currentVisibilityRadiusKm, orderMatchPoint } from "./matching.js";
import { redactOrder } from "./visibility.js";
import type { MobileMoneyNetwork } from "@tuma/shared";
import {
  activeProvider,
  initiateCollection,
  mobileMoneyNetworkLabel,
  UnsupportedNetworkError,
} from "../payments/service.js";
import { getR2Bucket } from "../storage/r2.js";

export const orderRoutes = new Hono();
orderRoutes.use("*", requireAuth);

type Row = Record<string, unknown>;

function formatAmount(n: number): string {
  return `UGX ${n.toLocaleString("en-UG")}`;
}

async function logEvent(orderId: string, stage: string, note: string, actorId: string) {
  await db.execute({
    sql: "INSERT INTO order_events (id, order_id, stage, note, actor_id) VALUES (?, ?, ?, ?, ?)",
    args: [newId("evt"), orderId, stage, note, actorId],
  });
}

async function getOrder(orderId: string): Promise<Row | undefined> {
  const res = await db.execute({
    sql: `SELECT o.*, u.name as customer_name FROM orders o
          LEFT JOIN users u ON u.id = o.customer_id
          WHERE o.id = ?`,
    args: [orderId],
  });
  return res.rows[0] as Row | undefined;
}

async function touchOrder(orderId: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  await db.execute({
    sql: `UPDATE orders SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    args: [...keys.map((k) => fields[k]), orderId] as unknown as InArgs,
  });
}

/** Throws a Response-shaped error the caller returns directly. */
class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

function assertCustomer(order: Row, userId: string) {
  if (order.customer_id !== userId) throw new HttpError(403, "Not your order");
}
function assertRider(order: Row, userId: string) {
  if (order.rider_id !== userId) throw new HttpError(403, "Not your assigned order");
}

/**
 * Strips the handover PIN out of every order this router returns, for
 * everyone except the order's own customer (and admins).
 *
 * Done here rather than at each `c.json({ order })` because there are a
 * dozen of those and the next route someone adds would quietly leak it
 * again. The PIN is the customer's proof that they physically received the
 * goods — a rider who can read it can claim a handover that never happened,
 * which is the single thing the PIN exists to prevent.
 */
orderRoutes.use("*", async (c, next) => {
  await next();
  const user = c.get("user");
  if (!user || user.role === "admin") return;
  if (!c.res.headers.get("content-type")?.includes("application/json")) return;

  const body = (await c.res
    .clone()
    .json()
    .catch(() => null)) as { order?: Row; orders?: Row[] } | null;
  if (!body || typeof body !== "object") return;

  const strip = (order: Row | undefined) => {
    if (!order || order.customer_id === user.sub || !("pin_code" in order)) return order;
    const { pin_code: _pin, ...rest } = order;
    return rest;
  };

  const hadOrder = body.order !== undefined;
  const hadOrders = Array.isArray(body.orders);
  if (!hadOrder && !hadOrders) return;

  const next_ = {
    ...body,
    ...(hadOrder ? { order: strip(body.order) } : {}),
    ...(hadOrders ? { orders: (body.orders as Row[]).map((o) => strip(o) as Row) } : {}),
  };
  c.res = new Response(JSON.stringify(next_), c.res);
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const createListSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        quantity: z.number().int().positive().default(1),
        unitCost: z.number().int().nonnegative().optional(),
        note: z.string().max(240).optional(),
      }),
    )
    .default([]),
});

orderRoutes.post("/lists", async (c) => {
  const user = c.get("user");
  const parsed = createListSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const listId = newId("list");
  const title = parsed.data.title?.trim() || "New shopping list";
  await db.execute({
    sql: "INSERT INTO lists (id, customer_id, title, status) VALUES (?, ?, ?, 'draft')",
    args: [listId, user.sub, title],
  });
  for (const item of parsed.data.items) {
    await db.execute({
      sql: "INSERT INTO list_items (id, list_id, name, quantity, unit_price, note) VALUES (?, ?, ?, ?, ?, ?)",
      args: [newId("item"), listId, item.name, item.quantity, item.unitCost ?? null, item.note ?? null],
    });
  }

  return c.json(
    {
      id: listId,
      listId,
      title,
      status: "draft",
      itemCount: parsed.data.items.length,
      createdAt: new Date().toISOString(),
      nextPath: `/orders/${listId}/create`,
    },
    201,
  );
});

orderRoutes.get("/lists/recent", async (c) => {
  const user = c.get("user");
  const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? "10") || 10, 50));
  const res = await db.execute({
    sql: `SELECT l.*, (SELECT COUNT(*) FROM list_items WHERE list_id = l.id) as item_count
          FROM lists l WHERE l.customer_id = ? ORDER BY l.updated_at DESC LIMIT ?`,
    args: [user.sub, limit],
  });
  return c.json({
    lists: res.rows.map((r) => ({
      id: r.id,
      listId: r.id,
      title: r.title,
      status: r.status,
      itemCount: r.item_count,
      updatedAt: r.updated_at,
    })),
  });
});

orderRoutes.get("/lists/:id", async (c) => {
  const id = c.req.param("id");
  const list = await db.execute({ sql: "SELECT * FROM lists WHERE id = ?", args: [id] });
  const row = list.rows[0];
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.customer_id !== c.get("user").sub) return c.json({ error: "forbidden" }, 403);
  const items = await db.execute({ sql: "SELECT * FROM list_items WHERE list_id = ?", args: [id] });
  return c.json({ list: row, items: items.rows });
});

// ---------------------------------------------------------------------------
// Orders — create / read
// ---------------------------------------------------------------------------

const createOrderSchema = z.object({
  listId: z.string(),
  type: z.enum(["shopping", "parcel"]).default("shopping"),
  pickupArea: z.string().max(120).optional(),
  pickupAddress: z.string().max(240).optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  destinationArea: z.string().max(120).optional(),
  destinationAddress: z.string().max(240).optional(),
  destinationLat: z.number().optional(),
  destinationLng: z.number().optional(),
  paymentRail: z.enum(["escrow", "float"]).default("escrow"),
  estimatedTotal: z.number().int().nonnegative().optional(),
});

orderRoutes.post("/orders", async (c) => {
  const user = c.get("user");
  const parsed = createOrderSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  const list = await db.execute({
    sql: "SELECT * FROM lists WHERE id = ?",
    args: [d.listId],
  });
  const listRow = list.rows[0];
  if (!listRow) return c.json({ error: "list_not_found" }, 404);
  if (listRow.customer_id !== user.sub) return c.json({ error: "forbidden" }, 403);

  // A parcel ride's cost is distance × the admin-set rate per km, computed
  // from pickup/destination coords whenever both were pinned on the map —
  // this always wins over any client-supplied estimate.
  //
  // Shopping orders have no pickup point (the "shop" is wherever the rider
  // goes), so there's no ride distance to price this way. The customer's own
  // estimate stands — but it becomes the amount escrow charges their mobile
  // money, so the server doesn't simply write down whatever arrived in the
  // request: it prefers the priced list when there is one, and refuses a
  // figure above the platform ceiling either way.
  let distanceKm: number | null = null;
  let estimatedTotal = d.estimatedTotal ?? null;
  if (d.type === "parcel" && d.pickupLat != null && d.pickupLng != null && d.destinationLat != null && d.destinationLng != null) {
    distanceKm = haversineKm(d.pickupLat, d.pickupLng, d.destinationLat, d.destinationLng);
    const { deliveryRatePerKm } = await getDeliverySettings();
    estimatedTotal = Math.round(distanceKm * deliveryRatePerKm);
  } else if (d.type === "shopping") {
    const priced = await db.execute({
      sql: `SELECT COUNT(*) AS total, COUNT(unit_price) AS priced,
                   COALESCE(SUM(quantity * unit_price), 0) AS sum_priced
            FROM list_items WHERE list_id = ?`,
      args: [d.listId],
    });
    const row = priced.rows[0] as Row | undefined;
    const itemCount = Number(row?.total ?? 0);
    const pricedCount = Number(row?.priced ?? 0);
    // Every item carries a price → the list itself is the quote, and the
    // client's separate estimate is redundant at best.
    if (itemCount > 0 && pricedCount === itemCount) {
      estimatedTotal = Number(row?.sum_priced ?? 0);
    }
  }

  if (estimatedTotal != null) {
    const maxOrderValue = await getMaxOrderValue();
    if (estimatedTotal > maxOrderValue) {
      return c.json(
        {
          error: "order_value_too_high",
          message: `Orders are capped at ${formatAmount(maxOrderValue)}. Please split this into smaller orders.`,
        },
        400,
      );
    }
  }

  const orderId = newId("ord");
  await db.execute({
    sql: `INSERT INTO orders (
            id, list_id, customer_id, stage, type, payment_rail, estimated_total,
            pickup_area, pickup_address, pickup_lat, pickup_lng,
            destination_area, destination_address, destination_lat, destination_lng, distance_km
          )
          VALUES (?, ?, ?, 'Create', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      orderId,
      d.listId,
      user.sub,
      d.type,
      d.paymentRail,
      estimatedTotal,
      d.pickupArea ?? null,
      d.pickupAddress ?? null,
      d.pickupLat ?? null,
      d.pickupLng ?? null,
      d.destinationArea ?? null,
      d.destinationAddress ?? null,
      d.destinationLat ?? null,
      d.destinationLng ?? null,
      distanceKm,
    ],
  });
  await db.execute({
    sql: "UPDATE lists SET status = 'active', updated_at = datetime('now') WHERE id = ?",
    args: [parsed.data.listId],
  });
  await logEvent(orderId, "Create", "Order created", user.sub);

  const order = await getOrder(orderId);
  return c.json({ order }, 201);
});

orderRoutes.get("/orders/active", async (c) => {
  const user = c.get("user");
  const res = await db.execute({
    sql: `SELECT o.*, u.name as customer_name FROM orders o
          LEFT JOIN users u ON u.id = o.customer_id
          WHERE o.customer_id = ? AND o.stage != 'Settle' ORDER BY o.updated_at DESC LIMIT 1`,
    args: [user.sub],
  });
  return c.json({ activeOrder: res.rows[0] ?? null });
});

orderRoutes.get("/orders/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.customer_id !== user.sub && order.rider_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }

  const [items, events, substitutions, payments, rating, feeProposals] = await Promise.all([
    db.execute({ sql: "SELECT * FROM list_items WHERE list_id = ?", args: [order.list_id as string] }),
    db.execute({ sql: "SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC", args: [id] }),
    db.execute({ sql: "SELECT * FROM substitutions WHERE order_id = ? ORDER BY created_at ASC", args: [id] }),
    db.execute({ sql: "SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC", args: [id] }),
    db.execute({ sql: "SELECT rating, comment FROM order_ratings WHERE order_id = ?", args: [id] }),
    db.execute({ sql: "SELECT * FROM fee_proposals WHERE order_id = ? ORDER BY created_at ASC", args: [id] }),
  ]);

  return c.json({
    order: redactOrder(order, user),
    items: items.rows,
    events: events.rows,
    substitutions: substitutions.rows,
    payments: payments.rows,
    rating: rating.rows[0] ?? null,
    feeProposals: feeProposals.rows,
  });
});

// ---------------------------------------------------------------------------
// Voice note — spoken context a typed list can miss (units, brand, exactly
// which shelf/shop). Attached by the customer, playable by whoever can
// already see the order.
// ---------------------------------------------------------------------------

const MAX_VOICE_NOTE_BYTES = 10 * 1024 * 1024;
const ALLOWED_VOICE_NOTE_MIME = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"]);

orderRoutes.post("/orders/:id/voice-note", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) return c.json({ error: "missing_audio" }, 400);
  if (!ALLOWED_VOICE_NOTE_MIME.has(file.type)) return c.json({ error: "unsupported_file_type" }, 400);
  if (file.size > MAX_VOICE_NOTE_BYTES) return c.json({ error: "file_too_large" }, 400);

  const ext = file.type.split("/")[1] ?? "webm";
  const key = `orders/${id}/voice-note.${ext}`;
  const bucket = getR2Bucket();
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  await touchOrder(id, { voice_note_key: key });
  await logEvent(id, order.stage as string, "Customer attached a voice note", user.sub);

  return c.json({ order: await getOrder(id) });
});

orderRoutes.get("/orders/:id/voice-note", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.customer_id !== user.sub && order.rider_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  const key = order.voice_note_key as string | null;
  if (!key) return c.json({ error: "not_found" }, 404);

  const bucket = getR2Bucket();
  const object = await bucket.get(key);
  if (!object) return c.json({ error: "not_found" }, 404);

  return new Response(object.body, {
    headers: { "Content-Type": object.httpMetadata?.contentType ?? "audio/webm" },
  });
});

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

orderRoutes.post("/orders/:id/match", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  // Normally an unmatched order is in "Create". A funded order whose rider
  // cancelled is left in "Match" with rider_id cleared instead of being
  // rewound to "Create" — that would re-expose the funding step even though
  // the customer already paid — so it's matchable again too.
  const canMatch = order.stage === "Create" || (order.stage === "Match" && !order.rider_id);
  if (!canMatch) {
    return c.json({ error: "invalid_stage", message: `Cannot match from stage ${order.stage}` }, 409);
  }

  // Staged radius broadcast, same as the rider-facing job list: riders
  // within 1km get first crack, then 2km, then 3km, then (once every tier
  // has had its turn) any verified + online rider regardless of distance —
  // so a lone rider far from a lone customer still eventually gets offered
  // the job instead of it silently sitting invisible forever. This auto-poll
  // is just a backstop for a rider who hasn't actively claimed it yet; it
  // must never jump ahead of a nearer rider's turn, so it uses the exact
  // same tier window as ../riders/routes.ts's available-jobs list.
  const { serviceRangeKm } = await getDeliverySettings();
  const matchPoint = orderMatchPoint(order);
  const visibleRadiusKm = currentVisibilityRadiusKm(order.updated_at as string);
  const fullyOpen = visibleRadiusKm == null;

  let candidate: Row | undefined;
  let outOfRange = false;

  const eligible = await db.execute({
    sql: `SELECT u.id, u.name, r.stage_lat, r.stage_lng, r.area FROM riders r JOIN users u ON u.id = r.user_id
          WHERE r.verified = 1 AND r.is_online = 1
          AND u.id NOT IN (SELECT rider_id FROM orders WHERE rider_id IS NOT NULL AND stage != 'Settle')
          AND u.id NOT IN (SELECT rider_id FROM order_rider_exclusions WHERE order_id = ?)`,
    args: [id],
  });

  let nearestKnown: { row: Row; distanceKm: number } | null = null;
  const unknownLocation: Row[] = [];
  for (const row of eligible.rows as Row[]) {
    const riderLat = row.stage_lat as number | null;
    const riderLng = row.stage_lng as number | null;
    if (matchPoint && riderLat != null && riderLng != null) {
      const distanceKm = haversineKm(matchPoint.lat, matchPoint.lng, riderLat, riderLng);
      if (!fullyOpen && distanceKm > (visibleRadiusKm as number)) continue; // not their turn yet
      if (!nearestKnown || distanceKm < nearestKnown.distanceKm) nearestKnown = { row, distanceKm };
    } else {
      unknownLocation.push(row);
    }
  }

  if (nearestKnown) {
    candidate = nearestKnown.row;
    outOfRange = nearestKnown.distanceKm > serviceRangeKm;
  } else if (fullyOpen || !matchPoint) {
    // No one within any tier has usable coordinates (or the order itself
    // has none to stage by) — fall back to a same-named-area match (still
    // counts as in range), then to any available rider at all. Only once
    // fully open, so a coarse area/any-rider grab can never preempt a
    // geo-known nearer rider mid-rollout.
    const area = order.destination_area as string | null;
    candidate = area ? unknownLocation.find((row) => row.area === area) : undefined;
    if (!candidate) {
      candidate = unknownLocation[0];
      if (candidate) outOfRange = true;
    }
  }

  if (!candidate) {
    return c.json({ error: "no_riders_available", message: "No verified riders online right now" }, 409);
  }

  // Cash orders have nothing for the customer to fund — the rider fronts
  // the money themselves — so there's no reason to leave the order sitting
  // in "Match" waiting on anyone. Skip straight to Shop. Escrow orders still
  // need the customer to actually pay in, so they stop at "Match" as before.
  const nextStage = order.payment_rail === "float" ? "Shop" : "Match";
  await touchOrder(id, { rider_id: candidate.id, stage: nextStage, matched_out_of_range: outOfRange ? 1 : 0 });
  await logEvent(
    id,
    "Match",
    outOfRange ? `Matched with rider ${candidate.name} (out of normal range)` : `Matched with rider ${candidate.name}`,
    user.sub,
  );
  if (order.payment_rail === "float") {
    await logEvent(id, "Fund", "Cash rail — rider fronting funds, no payment needed upfront", user.sub);
  }

  return c.json({ order: await getOrder(id) });
});

/**
 * A rider actively taking an unmatched job from their available-jobs list
 * (see GET /riders/jobs/available) — the primary way orders get assigned
 * now, with the auto-match poll above as a backstop for one nobody's
 * claimed yet. Same staged-radius rule applies here so a rider can't jump
 * the queue by hitting this directly before it's their tier's turn.
 */
orderRoutes.post("/orders/:id/claim", requireRole("rider"), async (c) => {
  const id = c.req.param("id") as string;
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.rider_id) {
    return c.json({ error: "already_claimed", message: "Another rider already took this job" }, 409);
  }
  const canClaim = order.stage === "Create" || (order.stage === "Match" && !order.rider_id);
  if (!canClaim) {
    return c.json({ error: "invalid_stage", message: `Cannot claim from stage ${order.stage}` }, 409);
  }

  const excluded = await db.execute({
    sql: "SELECT 1 FROM order_rider_exclusions WHERE order_id = ? AND rider_id = ?",
    args: [id, user.sub],
  });
  if (excluded.rows.length > 0) {
    return c.json({ error: "not_eligible", message: "You previously declined this order" }, 403);
  }

  const riderRes = await db.execute({
    sql: `SELECT r.verified, r.is_online, r.stage_lat, r.stage_lng, u.name FROM riders r
          JOIN users u ON u.id = r.user_id WHERE r.user_id = ?`,
    args: [user.sub],
  });
  const rider = riderRes.rows[0] as Row | undefined;
  if (!rider?.verified) return c.json({ error: "not_verified" }, 403);
  if (!rider.is_online) return c.json({ error: "not_online", message: "Go online to claim jobs" }, 409);

  const { serviceRangeKm } = await getDeliverySettings();
  const matchPoint = orderMatchPoint(order);
  const riderLat = rider.stage_lat as number | null;
  const riderLng = rider.stage_lng as number | null;
  const distanceKm =
    matchPoint && riderLat != null && riderLng != null
      ? haversineKm(matchPoint.lat, matchPoint.lng, riderLat, riderLng)
      : null;

  if (distanceKm != null) {
    const visibleRadiusKm = currentVisibilityRadiusKm(order.updated_at as string);
    if (visibleRadiusKm != null && distanceKm > visibleRadiusKm) {
      return c.json(
        { error: "not_yet_visible", message: "This order isn't open to your area yet — try again shortly" },
        409,
      );
    }
  }
  const outOfRange = distanceKm != null && distanceKm > serviceRangeKm;

  const nextStage = order.payment_rail === "float" ? "Shop" : "Match";
  const result = await db.execute({
    sql: `UPDATE orders SET rider_id = ?, stage = ?, matched_out_of_range = ?, updated_at = datetime('now')
          WHERE id = ? AND rider_id IS NULL AND stage IN ('Create', 'Match')`,
    args: [user.sub, nextStage, outOfRange ? 1 : 0, id],
  });
  if (result.rowsAffected === 0) {
    return c.json({ error: "already_claimed", message: "Another rider already took this job" }, 409);
  }

  await logEvent(
    id,
    "Match",
    outOfRange ? `Matched with rider ${rider.name} (out of normal range)` : `Matched with rider ${rider.name}`,
    user.sub,
  );
  if (order.payment_rail === "float") {
    await logEvent(id, "Fund", "Cash rail — rider fronting funds, no payment needed upfront", user.sub);
  }

  return c.json({ order: await getOrder(id) });
});

// ---------------------------------------------------------------------------
// Cancel — a rider backing out of a job they were matched to. The order
// drops back into the matching pool instead of being cancelled outright,
// and this rider is never offered it again.
// ---------------------------------------------------------------------------

const CANCELLABLE_STAGES = ["Match", "Fund", "Shop", "Substitute", "Approve", "Deliver"];

orderRoutes.post("/orders/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertRider(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (!CANCELLABLE_STAGES.includes(order.stage as string)) {
    return c.json({ error: "invalid_stage", message: `Cannot cancel from stage ${order.stage}` }, 409);
  }

  await db.execute({
    sql: "INSERT OR IGNORE INTO order_rider_exclusions (order_id, rider_id) VALUES (?, ?)",
    args: [id, user.sub],
  });

  // Money already collected? Skip back to "Match" (needs a new rider only) —
  // rewinding all the way to "Create" would re-expose the funding step and
  // risk a double charge. Otherwise a full "Create" rewind is safe.
  const paid = await db.execute({
    sql: "SELECT id FROM payments WHERE order_id = ? AND type = 'collection' AND status = 'successful' LIMIT 1",
    args: [id],
  });
  const nextStage = paid.rows.length > 0 ? "Match" : "Create";

  await touchOrder(id, { rider_id: null, stage: nextStage, matched_out_of_range: 0 });
  await logEvent(id, nextStage, "Rider cancelled — order returned to the job pool", user.sub);

  return c.json({ order: await getOrder(id) });
});

// ---------------------------------------------------------------------------
// Fund (escrow via mobile money collection, or float)
// ---------------------------------------------------------------------------

const fundSchema = z.object({ msisdn: z.string().min(6).max(20) });

orderRoutes.post("/orders/:id/fund", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (order.stage !== "Match") {
    return c.json({ error: "invalid_stage", message: `Cannot fund from stage ${order.stage}` }, 409);
  }

  // final_total is set the moment a fee proposal or item substitution is
  // approved — charge that when present so an accepted pre-funding fee
  // change is actually what gets collected, not the original estimate.
  const amount = (order.final_total as number | null) ?? (order.estimated_total as number | null) ?? 0;

  if (order.payment_rail === "float") {
    // Float rail: rider fronts the cash, no escrow collection needed.
    await touchOrder(id, { stage: "Shop" });
    await logEvent(id, "Fund", "Float rail — rider fronting funds", user.sub);
    return c.json({ order: await getOrder(id), funded: true, rail: "float" });
  }

  const parsed = fundSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const paymentId = newId("pay");
  let providerRef: string;
  let network: MobileMoneyNetwork;
  try {
    const initiated = await initiateCollection({ referenceId: paymentId, msisdn: parsed.data.msisdn, amount });
    providerRef = initiated.providerRef;
    network = initiated.network;
  } catch (err) {
    if (err instanceof UnsupportedNetworkError) {
      return c.json({ error: "unsupported_network", message: err.message }, 400);
    }
    console.error("Escrow collection request failed:", err);
    return c.json(
      { error: "payment_request_failed", message: "Couldn't reach mobile money just now. Please try again." },
      502,
    );
  }

  await db.execute({
    sql: `INSERT INTO payments (id, order_id, type, provider, provider_ref, msisdn, network, amount, currency, status)
          VALUES (?, ?, 'collection', ?, ?, ?, ?, ?, 'UGX', 'pending')`,
    args: [paymentId, id, activeProvider(), providerRef, parsed.data.msisdn, network, amount],
  });

  await touchOrder(id, { stage: "Fund" });
  await logEvent(id, "Fund", `${mobileMoneyNetworkLabel(network)} collection requested`, user.sub);

  return c.json({ order: await getOrder(id), payment: { id: paymentId, status: "pending", network } });
});

// ---------------------------------------------------------------------------
// Shop / Substitute / Approve
// ---------------------------------------------------------------------------

const substituteSchema = z.object({
  itemId: z.string().optional(),
  originalName: z.string().min(1).max(120),
  substituteName: z.string().min(1).max(120),
  priceDelta: z.number().int().default(0),
});

orderRoutes.post("/orders/:id/substitutions", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertRider(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (order.stage !== "Shop" && order.stage !== "Substitute") {
    return c.json({ error: "invalid_stage", message: `Cannot propose substitution from stage ${order.stage}` }, 409);
  }

  const parsed = substituteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const subId = newId("sub");
  await db.execute({
    sql: `INSERT INTO substitutions (id, order_id, item_id, original_name, substitute_name, price_delta)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [subId, id, parsed.data.itemId ?? null, parsed.data.originalName, parsed.data.substituteName, parsed.data.priceDelta],
  });
  await touchOrder(id, { stage: "Substitute" });
  await logEvent(id, "Substitute", `Proposed: ${parsed.data.originalName} → ${parsed.data.substituteName}`, user.sub);

  return c.json({ substitution: subId }, 201);
});

const batchSubstituteSchema = z.object({
  changes: z
    .array(
      z.object({
        itemId: z.string().optional(),
        originalName: z.string().min(1).max(120),
        substituteName: z.string().min(1).max(120),
        priceDelta: z.number().int().default(0),
      }),
    )
    .min(1)
    .max(50),
});

/** Same as POST /substitutions, but for several items at once — one review for the customer instead of many. */
orderRoutes.post("/orders/:id/substitutions/batch", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertRider(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (order.stage !== "Shop" && order.stage !== "Substitute") {
    return c.json({ error: "invalid_stage", message: `Cannot propose changes from stage ${order.stage}` }, 409);
  }

  const parsed = batchSubstituteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const batchId = newId("batch");
  for (const change of parsed.data.changes) {
    await db.execute({
      sql: `INSERT INTO substitutions (id, order_id, item_id, original_name, substitute_name, price_delta, batch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [newId("sub"), id, change.itemId ?? null, change.originalName, change.substituteName, change.priceDelta, batchId],
    });
  }
  await touchOrder(id, { stage: "Substitute" });
  const netDelta = parsed.data.changes.reduce((sum, ch) => sum + ch.priceDelta, 0);
  await logEvent(
    id,
    "Substitute",
    `Proposed ${parsed.data.changes.length} change(s) for approval (${netDelta >= 0 ? "+" : ""}${netDelta})`,
    user.sub,
  );

  return c.json({ batchId, order: await getOrder(id) }, 201);
});

orderRoutes.post("/orders/:id/substitutions/batch/:batchId/decision", async (c) => {
  const id = c.req.param("id");
  const batchId = c.req.param("batchId");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }

  const parsed = decisionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const batchRes = await db.execute({
    sql: "SELECT * FROM substitutions WHERE order_id = ? AND batch_id = ? AND status = 'pending'",
    args: [id, batchId],
  });
  const rows = batchRes.rows as Row[];
  if (rows.length === 0) return c.json({ error: "not_found" }, 404);

  const status = parsed.data.approve ? "approved" : "rejected";
  await db.execute({
    sql: "UPDATE substitutions SET status = ?, updated_at = datetime('now') WHERE order_id = ? AND batch_id = ?",
    args: [status, id, batchId],
  });

  if (parsed.data.approve) {
    const netDelta = rows.reduce((sum, r) => sum + ((r.price_delta as number) ?? 0), 0);
    if (netDelta) {
      const currentTotal = (order.final_total as number | null) ?? (order.estimated_total as number | null) ?? 0;
      await touchOrder(id, { final_total: currentTotal + netDelta });
    }
  }

  await logEvent(id, "Approve", `Batch of ${rows.length} change(s) ${status}`, user.sub);

  const remaining = await db.execute({
    sql: "SELECT COUNT(*) as n FROM substitutions WHERE order_id = ? AND status = 'pending'",
    args: [id],
  });
  if ((remaining.rows[0]?.n as number) === 0) {
    await touchOrder(id, { stage: "Approve" });
  }

  return c.json({ order: await getOrder(id) });
});

const decisionSchema = z.object({ approve: z.boolean() });

orderRoutes.post("/orders/:id/substitutions/:subId/decision", async (c) => {
  const id = c.req.param("id");
  const subId = c.req.param("subId");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }

  const parsed = decisionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const subRes = await db.execute({ sql: "SELECT * FROM substitutions WHERE id = ? AND order_id = ?", args: [subId, id] });
  const sub = subRes.rows[0];
  if (!sub) return c.json({ error: "not_found" }, 404);

  const status = parsed.data.approve ? "approved" : "rejected";
  await db.execute({
    sql: "UPDATE substitutions SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [status, subId],
  });

  if (parsed.data.approve && sub.price_delta) {
    const currentTotal = (order.final_total as number | null) ?? (order.estimated_total as number | null) ?? 0;
    await touchOrder(id, { final_total: currentTotal + (sub.price_delta as number) });
  }

  await logEvent(id, "Approve", `Substitution ${status}: ${sub.substitute_name}`, user.sub);

  const remaining = await db.execute({
    sql: "SELECT COUNT(*) as n FROM substitutions WHERE order_id = ? AND status = 'pending'",
    args: [id],
  });
  if ((remaining.rows[0]?.n as number) === 0) {
    await touchOrder(id, { stage: "Approve" });
  }

  return c.json({ order: await getOrder(id) });
});

// ---------------------------------------------------------------------------
// Fee proposals — rider suggests a different total than the auto-calculated
// (or customer-entered) one; customer accepts or rejects it.
// ---------------------------------------------------------------------------

const proposeFeeSchema = z.object({
  proposedTotal: z.number().int().nonnegative(),
  reason: z.string().max(240).optional(),
});

orderRoutes.post("/orders/:id/fee-proposals", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertRider(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (order.stage === "Create" || order.stage === "Settle") {
    return c.json({ error: "invalid_stage", message: `Cannot propose a fee from stage ${order.stage}` }, 409);
  }

  const parsed = proposeFeeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const previousTotal = (order.final_total as number | null) ?? (order.estimated_total as number | null) ?? 0;
  const proposalId = newId("fee");
  await db.execute({
    sql: `INSERT INTO fee_proposals (id, order_id, previous_total, proposed_total, reason)
          VALUES (?, ?, ?, ?, ?)`,
    args: [proposalId, id, previousTotal, parsed.data.proposedTotal, parsed.data.reason ?? null],
  });
  await logEvent(
    id,
    order.stage as string,
    `Rider suggested a new total: ${formatAmount(parsed.data.proposedTotal)} (was ${formatAmount(previousTotal)})`,
    user.sub,
  );

  return c.json({ proposalId, order: await getOrder(id) }, 201);
});

orderRoutes.post("/orders/:id/fee-proposals/:proposalId/decision", async (c) => {
  const id = c.req.param("id");
  const proposalId = c.req.param("proposalId");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }

  const parsed = decisionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const propRes = await db.execute({
    sql: "SELECT * FROM fee_proposals WHERE id = ? AND order_id = ? AND status = 'pending'",
    args: [proposalId, id],
  });
  const proposal = propRes.rows[0] as Row | undefined;
  if (!proposal) return c.json({ error: "not_found" }, 404);

  const status = parsed.data.approve ? "approved" : "rejected";
  await db.execute({
    sql: "UPDATE fee_proposals SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [status, proposalId],
  });

  if (parsed.data.approve) {
    await touchOrder(id, { final_total: proposal.proposed_total });
  }
  await logEvent(
    id,
    order.stage as string,
    `Fee suggestion ${status}${parsed.data.approve ? ` — new total ${formatAmount(proposal.proposed_total as number)}` : ""}`,
    user.sub,
  );

  return c.json({ order: await getOrder(id) });
});

// ---------------------------------------------------------------------------
// Deliver / Handover / Settle
// ---------------------------------------------------------------------------

const deliverSchema = z.object({ etaMinutes: z.number().int().positive().optional() });

orderRoutes.post("/orders/:id/deliver", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertRider(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (!["Shop", "Substitute", "Approve"].includes(order.stage as string)) {
    return c.json({ error: "invalid_stage", message: `Cannot start delivery from stage ${order.stage}` }, 409);
  }

  const parsed = deliverSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const pin = (order.pin_code as string | null) ?? newPin();
  await touchOrder(id, {
    stage: "Deliver",
    eta_minutes: parsed.data.etaMinutes ?? order.eta_minutes ?? 15,
    pin_code: pin,
  });
  await logEvent(id, "Deliver", "Rider en route", user.sub);

  return c.json({ order: await getOrder(id) });
});

const handoverSchema = z.object({ pin: z.string().length(4) });

orderRoutes.post("/orders/:id/handover", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (order.stage !== "Deliver") {
    return c.json({ error: "invalid_stage", message: `Cannot hand over from stage ${order.stage}` }, 409);
  }

  const parsed = handoverSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  if (parsed.data.pin !== order.pin_code) {
    return c.json({ error: "pin_mismatch" }, 400);
  }

  await touchOrder(id, { stage: "Handover" });
  await logEvent(id, "Handover", "PIN confirmed, handover complete", user.sub);

  return c.json({ order: await getOrder(id) });
});

// Settling is the rider's own confirmation that the job is done — the
// customer already gave theirs by entering the handover PIN. Requiring both
// before any money moves is the whole point of escrow: nothing releases
// from it until each side has confirmed. Escrow proceeds are credited to
// the rider's in-app wallet here rather than wired out immediately; they
// withdraw to mobile money separately, whenever they want. Cash-rail jobs
// have nothing to release — the rider already holds the cash — so this
// just closes the job out.
orderRoutes.post("/orders/:id/settle", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.rider_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden", message: "Only the assigned rider can settle this order" }, 403);
  }
  if (order.stage !== "Handover") {
    return c.json({ error: "invalid_stage", message: `Cannot settle from stage ${order.stage}` }, 409);
  }

  const total = (order.final_total as number | null) ?? (order.estimated_total as number | null) ?? 0;

  let released = 0;
  if (order.payment_rail === "escrow" && order.rider_id) {
    // Release only what escrow actually holds, never `final_total`. An
    // approved fee proposal or substitution raises `final_total` after the
    // collection has already happened, with no top-up charged — paying that
    // out would hand the rider money the platform never received, which is
    // exactly the hole a rider colluding with a throwaway customer account
    // would mint from. Anything agreed above what was collected is a debt to
    // settle out of band, so it's logged rather than silently paid.
    const collectedRes = await db.execute({
      sql: `SELECT COALESCE(SUM(amount), 0) as collected FROM payments
            WHERE order_id = ? AND type = 'collection' AND status = 'successful'`,
      args: [id],
    });
    released = Number((collectedRes.rows[0] as Row)?.collected ?? 0);

    if (released > 0) {
      await db.execute({
        sql: "UPDATE riders SET wallet_balance = wallet_balance + ?, updated_at = datetime('now') WHERE user_id = ?",
        args: [released, order.rider_id as string],
      });
    }
    if (released < total) {
      await logEvent(
        id,
        "Settle",
        `Shortfall — ${formatAmount(total - released)} of the agreed total was never collected into escrow and was not paid out`,
        user.sub,
      );
    }
  }

  await touchOrder(id, { stage: "Settle", final_total: total });
  await db.execute({
    sql: "UPDATE lists SET status = 'delivered', updated_at = datetime('now') WHERE id = ?",
    args: [order.list_id as string],
  });
  await logEvent(
    id,
    "Settle",
    order.payment_rail === "escrow" ? `Order settled — ${formatAmount(released)} released to rider wallet` : "Order settled",
    user.sub,
  );

  return c.json({ order: await getOrder(id) });
});

// ---------------------------------------------------------------------------
// Rating — customer rates the rider once an order is delivered
// ---------------------------------------------------------------------------

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

orderRoutes.post("/orders/:id/rate", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  try {
    assertCustomer(order, user.sub);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
  if (order.stage !== "Settle") {
    return c.json({ error: "invalid_stage", message: "Can only rate a delivered order" }, 409);
  }
  if (!order.rider_id) {
    return c.json({ error: "no_rider" }, 409);
  }

  const parsed = rateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const existing = await db.execute({ sql: "SELECT id FROM order_ratings WHERE order_id = ?", args: [id] });
  if (existing.rows.length > 0) {
    return c.json({ error: "already_rated" }, 409);
  }

  await db.execute({
    sql: `INSERT INTO order_ratings (id, order_id, customer_id, rider_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [newId("rat"), id, user.sub, order.rider_id as string, parsed.data.rating, parsed.data.comment ?? null],
  });
  await db.execute({
    sql: `UPDATE riders SET rating = (SELECT AVG(rating) FROM order_ratings WHERE rider_id = ?), updated_at = datetime('now') WHERE user_id = ?`,
    args: [order.rider_id as string, order.rider_id as string],
  });

  return c.json({ ok: true, rating: parsed.data.rating, comment: parsed.data.comment ?? null });
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

orderRoutes.get("/orders/:id/chat", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.customer_id !== user.sub && order.rider_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  const res = await db.execute({
    sql: "SELECT * FROM chat_messages WHERE order_id = ? ORDER BY created_at ASC",
    args: [id],
  });
  return c.json({ messages: res.rows });
});

const chatSchema = z.object({ body: z.string().min(1).max(2000) });

orderRoutes.post("/orders/:id/chat", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.customer_id !== user.sub && order.rider_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  const parsed = chatSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const messageId = newId("msg");
  await db.execute({
    sql: "INSERT INTO chat_messages (id, order_id, sender_id, sender_role, body) VALUES (?, ?, ?, ?, ?)",
    args: [messageId, id, user.sub, user.role, parsed.data.body],
  });
  return c.json({ id: messageId }, 201);
});
