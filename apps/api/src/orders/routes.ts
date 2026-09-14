import { Hono } from "hono";
import { z } from "zod";
import type { InArgs } from "@libsql/client";
import { db } from "../db/client.js";
import { requireAuth } from "../auth/middleware.js";
import { haversineKm } from "../lib/geo.js";
import { newId, newPin } from "../lib/ids.js";
import { getDeliverySettings } from "../lib/settings.js";
import { isMomoConfigured, requestToPay, transfer } from "../momo/client.js";
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
  // this always wins over any client-supplied estimate. Shopping orders have
  // no pickup point (the "shop" is wherever the rider goes), so there's no
  // ride distance to price this way; they keep the customer's own estimate.
  let distanceKm: number | null = null;
  let estimatedTotal = d.estimatedTotal ?? null;
  if (d.type === "parcel" && d.pickupLat != null && d.pickupLng != null && d.destinationLat != null && d.destinationLng != null) {
    distanceKm = haversineKm(d.pickupLat, d.pickupLng, d.destinationLat, d.destinationLng);
    const { deliveryRatePerKm } = await getDeliverySettings();
    estimatedTotal = Math.round(distanceKm * deliveryRatePerKm);
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
    order,
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

  // Nearest-available matching: among verified + online + unassigned riders
  // who have a stage location, pick the closest to where this ride starts
  // (pickup point for a parcel, destination for a shopping run, since
  // there's no separate pickup point for those). If that rider is beyond
  // the normal service range — or no rider has location data at all — we
  // still match them rather than leave the customer with nobody, but flag
  // it so the customer can be told the ride may cost a bit more than usual.
  const { serviceRangeKm } = await getDeliverySettings();
  const matchLat = (order.type === "parcel" ? order.pickup_lat : order.destination_lat) as number | null;
  const matchLng = (order.type === "parcel" ? order.pickup_lng : order.destination_lng) as number | null;

  let candidate: Row | undefined;
  let outOfRange = false;

  if (matchLat != null && matchLng != null) {
    const geoRiders = await db.execute({
      sql: `SELECT u.id, u.name, r.stage_lat, r.stage_lng FROM riders r JOIN users u ON u.id = r.user_id
            WHERE r.verified = 1 AND r.is_online = 1 AND r.stage_lat IS NOT NULL AND r.stage_lng IS NOT NULL
            AND u.id NOT IN (SELECT rider_id FROM orders WHERE rider_id IS NOT NULL AND stage != 'Settle')
            AND u.id NOT IN (SELECT rider_id FROM order_rider_exclusions WHERE order_id = ?)`,
      args: [id],
    });
    let nearest: { row: Row; distanceKm: number } | null = null;
    for (const row of geoRiders.rows as Row[]) {
      const distanceKm = haversineKm(matchLat, matchLng, row.stage_lat as number, row.stage_lng as number);
      if (!nearest || distanceKm < nearest.distanceKm) nearest = { row, distanceKm };
    }
    if (nearest) {
      candidate = nearest.row;
      outOfRange = nearest.distanceKm > serviceRangeKm;
    }
  }

  // No rider with usable coordinates nearby — fall back to a same-named-area
  // match (still counts as "in range"), then to any available rider at all.
  if (!candidate) {
    const area = order.destination_area as string | null;
    const byArea = area
      ? await db.execute({
          sql: `SELECT u.id, u.name FROM riders r JOIN users u ON u.id = r.user_id
                WHERE r.verified = 1 AND r.is_online = 1 AND r.area = ?
                AND u.id NOT IN (SELECT rider_id FROM orders WHERE rider_id IS NOT NULL AND stage != 'Settle')
                AND u.id NOT IN (SELECT rider_id FROM order_rider_exclusions WHERE order_id = ?)
                LIMIT 1`,
          args: [area, id],
        })
      : { rows: [] as Row[] };
    candidate = byArea.rows[0] as Row | undefined;
  }

  if (!candidate) {
    const any = await db.execute({
      sql: `SELECT u.id, u.name FROM riders r JOIN users u ON u.id = r.user_id
            WHERE r.verified = 1 AND r.is_online = 1
            AND u.id NOT IN (SELECT rider_id FROM orders WHERE rider_id IS NOT NULL AND stage != 'Settle')
            AND u.id NOT IN (SELECT rider_id FROM order_rider_exclusions WHERE order_id = ?)
            LIMIT 1`,
      args: [id],
    });
    candidate = any.rows[0] as Row | undefined;
    if (candidate) outOfRange = true;
  }

  if (!candidate) {
    return c.json({ error: "no_riders_available", message: "No verified riders online right now" }, 409);
  }

  await touchOrder(id, { rider_id: candidate.id, stage: "Match", matched_out_of_range: outOfRange ? 1 : 0 });
  await logEvent(
    id,
    "Match",
    outOfRange ? `Matched with rider ${candidate.name} (out of normal range)` : `Matched with rider ${candidate.name}`,
    user.sub,
  );

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
// Fund (escrow via MoMo Collections, or float)
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
  await db.execute({
    sql: `INSERT INTO payments (id, order_id, type, provider, provider_ref, msisdn, amount, currency, status)
          VALUES (?, ?, 'collection', 'momo', ?, ?, ?, 'UGX', 'pending')`,
    args: [paymentId, id, paymentId, parsed.data.msisdn, amount],
  });

  if (!isMomoConfigured()) {
    return c.json(
      {
        error: "momo_not_configured",
        message:
          "MoMo API credentials are not set. Run provision-sandbox (see apps/api/src/momo/provision-sandbox.ts) or set MOMO_* env vars.",
        payment: { id: paymentId, status: "pending" },
      },
      503,
    );
  }

  try {
    await requestToPay({
      referenceId: paymentId,
      amount,
      currency: process.env.MOMO_CURRENCY ?? "UGX",
      msisdn: parsed.data.msisdn,
      externalId: id,
      payerMessage: "Tuma order escrow funding",
    });
  } catch (err) {
    await db.execute({
      sql: "UPDATE payments SET status = 'failed', raw_payload = ?, updated_at = datetime('now') WHERE id = ?",
      args: [String(err), paymentId],
    });
    return c.json({ error: "momo_request_failed", message: String(err) }, 502);
  }

  await touchOrder(id, { stage: "Fund" });
  await logEvent(id, "Fund", "MoMo collection requested", user.sub);

  return c.json({ order: await getOrder(id), payment: { id: paymentId, status: "pending" } });
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

orderRoutes.post("/orders/:id/settle", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const order = await getOrder(id);
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.customer_id !== user.sub && order.rider_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  if (order.stage !== "Handover") {
    return c.json({ error: "invalid_stage", message: `Cannot settle from stage ${order.stage}` }, 409);
  }

  const total = (order.final_total as number | null) ?? (order.estimated_total as number | null) ?? 0;

  if (order.payment_rail === "escrow" && order.rider_id) {
    const riderRow = await db.execute({
      sql: "SELECT momo_msisdn FROM riders WHERE user_id = ?",
      args: [order.rider_id as string],
    });
    const msisdn = riderRow.rows[0]?.momo_msisdn as string | undefined;

    if (!msisdn) {
      return c.json({ error: "rider_missing_momo", message: "Rider has no MoMo number on file" }, 409);
    }
    if (!isMomoConfigured()) {
      return c.json({ error: "momo_not_configured" }, 503);
    }

    const paymentId = newId("pay");
    await db.execute({
      sql: `INSERT INTO payments (id, order_id, type, provider, provider_ref, msisdn, amount, currency, status)
            VALUES (?, ?, 'disbursement', 'momo', ?, ?, ?, 'UGX', 'pending')`,
      args: [paymentId, id, paymentId, msisdn, total],
    });

    try {
      await transfer({
        referenceId: paymentId,
        amount: total,
        currency: process.env.MOMO_CURRENCY ?? "UGX",
        msisdn,
        externalId: id,
        payerMessage: "Tuma rider payout",
      });
    } catch (err) {
      await db.execute({
        sql: "UPDATE payments SET status = 'failed', raw_payload = ?, updated_at = datetime('now') WHERE id = ?",
        args: [String(err), paymentId],
      });
      return c.json({ error: "momo_transfer_failed", message: String(err) }, 502);
    }
  }

  await touchOrder(id, { stage: "Settle", final_total: total });
  await db.execute({
    sql: "UPDATE lists SET status = 'delivered', updated_at = datetime('now') WHERE id = ?",
    args: [order.list_id as string],
  });
  await logEvent(id, "Settle", "Order settled", user.sub);

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
