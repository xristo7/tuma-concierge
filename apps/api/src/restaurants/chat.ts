/**
 * Customer <-> restaurant messaging. Kept separate from ../orders chat
 * (chat_messages, hard-wired to customer/rider order pairs) — a restaurant
 * owner isn't a first-class role, and this thread isn't order-scoped: a
 * customer can ask a restaurant about a dish before ever ordering, and the
 * thread stays continuous across orders. See migrations/0037_restaurant_chat.sql.
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { baseMimeType, extensionForMime } from "../lib/mime.js";
import { notifyUser } from "../lib/webpush.js";
import { getR2Bucket, uploadResponseHeaders } from "../storage/r2.js";

export const restaurantChatRoutes = new Hono();

type Row = Record<string, unknown>;

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function preview(type: string, body: string | null): string {
  if (type === "image") return "📷 Photo";
  return body && body.length > 60 ? `${body.slice(0, 60)}…` : body || "";
}

async function restaurantByOwner(ownerId: string): Promise<Row | undefined> {
  const res = await db.execute({ sql: "SELECT * FROM restaurants WHERE owner_id = ?", args: [ownerId] });
  return res.rows[0] as Row | undefined;
}

async function restaurantById(id: string): Promise<Row | undefined> {
  const res = await db.execute({ sql: "SELECT * FROM restaurants WHERE id = ?", args: [id] });
  return res.rows[0] as Row | undefined;
}

// ---------------------------------------------------------------------------
// Customer side — one thread per (restaurant, customer) pair.
// ---------------------------------------------------------------------------

restaurantChatRoutes.get("/restaurants/:id/chat", requireAuth, async (c) => {
  const restaurantId = c.req.param("id") as string;
  const user = c.get("user");
  const restaurant = await restaurantById(restaurantId);
  if (!restaurant) return c.json({ error: "not_found" }, 404);

  const res = await db.execute({
    sql: `SELECT * FROM restaurant_chat_messages WHERE restaurant_id = ? AND customer_id = ? ORDER BY created_at ASC`,
    args: [restaurantId, user.sub],
  });
  return c.json({
    restaurantName: restaurant.name,
    messages: res.rows,
  });
});

const sendSchema = z.object({
  body: z.string().min(1).max(2000),
  menuItemId: z.string().optional(),
  menuItemName: z.string().optional(),
});

restaurantChatRoutes.post("/restaurants/:id/chat", requireAuth, requireRole("customer"), async (c) => {
  const restaurantId = c.req.param("id") as string;
  const user = c.get("user");
  const restaurant = await restaurantById(restaurantId);
  if (!restaurant) return c.json({ error: "not_found" }, 404);

  const contentType = c.req.header("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof File)) return c.json({ error: "missing_image" }, 400);
    if (!ALLOWED_PHOTO_MIME.has(baseMimeType(file.type))) return c.json({ error: "unsupported_file_type" }, 400);
    if (file.size > MAX_PHOTO_BYTES) return c.json({ error: "file_too_large" }, 400);

    const messageId = newId("rmsg");
    const ext = extensionForMime(file.type, "jpg");
    const key = `restaurants/${restaurantId}/chat/${user.sub}/${messageId}.${ext}`;
    const bucket = getR2Bucket();
    await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

    await db.execute({
      sql: `INSERT INTO restaurant_chat_messages (id, restaurant_id, customer_id, sender_role, type, media_key)
            VALUES (?, ?, ?, 'customer', 'image', ?)`,
      args: [messageId, restaurantId, user.sub, key],
    });
    notifyUser(restaurant.owner_id as string, {
      title: user.name || "New message",
      body: preview("image", null),
      url: `/chat/${user.sub}`,
      tag: `restaurant-chat-${restaurantId}-${user.sub}`,
    }).catch(() => {});
    return c.json({ id: messageId }, 201);
  }

  const parsed = sendSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const messageId = newId("rmsg");
  await db.execute({
    sql: `INSERT INTO restaurant_chat_messages (id, restaurant_id, customer_id, sender_role, body, menu_item_id, menu_item_name)
          VALUES (?, ?, ?, 'customer', ?, ?, ?)`,
    args: [messageId, restaurantId, user.sub, parsed.data.body, parsed.data.menuItemId ?? null, parsed.data.menuItemName ?? null],
  });
  notifyUser(restaurant.owner_id as string, {
    title: user.name || "New message",
    body: preview("text", parsed.data.body),
    url: `/chat/${user.sub}`,
    tag: `restaurant-chat-${restaurantId}-${user.sub}`,
  }).catch(() => {});
  return c.json({ id: messageId }, 201);
});

restaurantChatRoutes.post("/restaurants/:id/chat/read", requireAuth, requireRole("customer"), async (c) => {
  const restaurantId = c.req.param("id") as string;
  const user = c.get("user");
  await db.execute({
    sql: `UPDATE restaurant_chat_messages SET read = 1
          WHERE restaurant_id = ? AND customer_id = ? AND sender_role = 'restaurant'`,
    args: [restaurantId, user.sub],
  });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Restaurant-owner side — threads with every customer who's messaged.
// ---------------------------------------------------------------------------

restaurantChatRoutes.get("/restaurants/me/chat/threads", requireAuth, requireRole("customer"), async (c) => {
  const user = c.get("user");
  const restaurant = await restaurantByOwner(user.sub);
  if (!restaurant) return c.json({ error: "not_found" }, 404);

  const res = await db.execute({
    sql: `SELECT m.customer_id, u.name as customer_name,
                 MAX(m.created_at) as last_message_at,
                 SUM(CASE WHEN m.sender_role = 'customer' AND m.read = 0 THEN 1 ELSE 0 END) as unread_count
          FROM restaurant_chat_messages m
          JOIN users u ON u.id = m.customer_id
          WHERE m.restaurant_id = ?
          GROUP BY m.customer_id
          ORDER BY last_message_at DESC`,
    args: [restaurant.id as string],
  });
  return c.json({ threads: res.rows });
});

restaurantChatRoutes.get("/restaurants/me/chat/:customerId", requireAuth, requireRole("customer"), async (c) => {
  const customerId = c.req.param("customerId") as string;
  const user = c.get("user");
  const restaurant = await restaurantByOwner(user.sub);
  if (!restaurant) return c.json({ error: "not_found" }, 404);

  const res = await db.execute({
    sql: `SELECT * FROM restaurant_chat_messages WHERE restaurant_id = ? AND customer_id = ? ORDER BY created_at ASC`,
    args: [restaurant.id as string, customerId],
  });
  const nameRes = await db.execute({ sql: "SELECT name FROM users WHERE id = ?", args: [customerId] });
  return c.json({
    customerName: (nameRes.rows[0] as Row | undefined)?.name ?? null,
    messages: res.rows,
  });
});

restaurantChatRoutes.post("/restaurants/me/chat/:customerId", requireAuth, requireRole("customer"), async (c) => {
  const customerId = c.req.param("customerId") as string;
  const user = c.get("user");
  const restaurant = await restaurantByOwner(user.sub);
  if (!restaurant) return c.json({ error: "not_found" }, 404);

  const contentType = c.req.header("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof File)) return c.json({ error: "missing_image" }, 400);
    if (!ALLOWED_PHOTO_MIME.has(baseMimeType(file.type))) return c.json({ error: "unsupported_file_type" }, 400);
    if (file.size > MAX_PHOTO_BYTES) return c.json({ error: "file_too_large" }, 400);

    const messageId = newId("rmsg");
    const ext = extensionForMime(file.type, "jpg");
    const key = `restaurants/${restaurant.id}/chat/${customerId}/${messageId}.${ext}`;
    const bucket = getR2Bucket();
    await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

    await db.execute({
      sql: `INSERT INTO restaurant_chat_messages (id, restaurant_id, customer_id, sender_role, type, media_key)
            VALUES (?, ?, ?, 'restaurant', 'image', ?)`,
      args: [messageId, restaurant.id as string, customerId, key],
    });
    notifyUser(customerId, {
      title: (restaurant.name as string) || "New message",
      body: preview("image", null),
      url: `/chat/${restaurant.id}`,
      tag: `restaurant-chat-${restaurant.id}-${customerId}`,
    }).catch(() => {});
    return c.json({ id: messageId }, 201);
  }

  const parsed = z.object({ body: z.string().min(1).max(2000) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const messageId = newId("rmsg");
  await db.execute({
    sql: `INSERT INTO restaurant_chat_messages (id, restaurant_id, customer_id, sender_role, body)
          VALUES (?, ?, ?, 'restaurant', ?)`,
    args: [messageId, restaurant.id as string, customerId, parsed.data.body],
  });
  notifyUser(customerId, {
    title: (restaurant.name as string) || "New message",
    body: preview("text", parsed.data.body),
    url: `/chat/${restaurant.id}`,
    tag: `restaurant-chat-${restaurant.id}-${customerId}`,
  }).catch(() => {});
  return c.json({ id: messageId }, 201);
});

restaurantChatRoutes.post("/restaurants/me/chat/:customerId/read", requireAuth, requireRole("customer"), async (c) => {
  const customerId = c.req.param("customerId") as string;
  const user = c.get("user");
  const restaurant = await restaurantByOwner(user.sub);
  if (!restaurant) return c.json({ error: "not_found" }, 404);

  await db.execute({
    sql: `UPDATE restaurant_chat_messages SET read = 1
          WHERE restaurant_id = ? AND customer_id = ? AND sender_role = 'customer'`,
    args: [restaurant.id as string, customerId],
  });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Media — access-checked against the message's own restaurant/customer ids,
// open to either party (or the restaurant's owner) in that conversation.
// ---------------------------------------------------------------------------

restaurantChatRoutes.get("/restaurant-chat/media/:messageId", requireAuth, async (c) => {
  const messageId = c.req.param("messageId") as string;
  const user = c.get("user");

  const res = await db.execute({
    sql: `SELECT m.media_key, m.restaurant_id, m.customer_id, r.owner_id
          FROM restaurant_chat_messages m JOIN restaurants r ON r.id = m.restaurant_id
          WHERE m.id = ?`,
    args: [messageId],
  });
  const row = res.rows[0] as Row | undefined;
  if (!row || !row.media_key) return c.json({ error: "not_found" }, 404);
  if (row.customer_id !== user.sub && row.owner_id !== user.sub && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }

  const bucket = getR2Bucket();
  const object = await bucket.get(row.media_key as string);
  if (!object) return c.json({ error: "not_found" }, 404);

  return new Response(object.body, {
    headers: uploadResponseHeaders(object.httpMetadata?.contentType, "image/jpeg"),
  });
});
