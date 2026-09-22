/**
 * Voice calls between any two account holders — customer, rider, or
 * restaurant owner (a restaurant owner is a normal customer-role account,
 * see ../restaurants/routes.ts, so no role check is needed beyond being
 * signed in). Signaling (ring/accept/decline/end) is polled, same pattern
 * as chat threads elsewhere in this app — no separate WebSocket/Durable
 * Object infra. The actual audio path depends on the admin-selected
 * provider (../lib/settings.ts getActiveCallProvider): "mock" runs this
 * entire flow with no real audio (safe default, useful for UI testing),
 * "cloudflare" proxies WebRTC negotiation to Realtime SFU (../calls/
 * cloudflare.ts), "twilio"/"agora" are selectable but not implemented yet.
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { notifyUser } from "../lib/webpush.js";
import { getActiveCallProvider, getPlatformEnvironment } from "../lib/settings.js";
import {
  createCallSession,
  nameLocalAudioTrack,
  pullRemoteAudioTrack,
  renegotiateCallSession,
  CloudflareCallsNotConfiguredError,
  CloudflareCallsApiError,
  type SdpDescription,
} from "./cloudflare.js";

export const callRoutes = new Hono();
callRoutes.use("*", requireAuth);

type Row = Record<string, unknown>;

async function loadOwnedCall(id: string, userId: string): Promise<Row | undefined> {
  const res = await db.execute({ sql: "SELECT * FROM calls WHERE id = ?", args: [id] });
  const call = res.rows[0] as Row | undefined;
  if (!call) return undefined;
  if (call.caller_id !== userId && call.callee_id !== userId) return undefined;
  return call;
}

const startSchema = z.object({
  calleeId: z.string().min(1),
  orderId: z.string().optional(),
  restaurantId: z.string().optional(),
});

/** Places a call — creates the ringing row and pushes a notification to
 * the callee. The caller starts polling GET /calls/:id right away for the
 * callee's accept/decline; the callee's app polls GET /calls/incoming to
 * discover it (same shape as chat's unread-thread polling). */
callRoutes.post("/calls", async (c) => {
  const user = c.get("user");
  const parsed = startSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  if (d.calleeId === user.sub) return c.json({ error: "cannot_call_self" }, 400);

  const provider = await getActiveCallProvider();
  const environment = await getPlatformEnvironment();
  const id = newId("call");
  await db.execute({
    sql: `INSERT INTO calls (id, caller_id, callee_id, order_id, restaurant_id, provider, status, environment)
          VALUES (?, ?, ?, ?, ?, ?, 'ringing', ?)`,
    args: [id, user.sub, d.calleeId, d.orderId ?? null, d.restaurantId ?? null, provider, environment],
  });

  await notifyUser(d.calleeId, {
    title: `${user.name ?? "Someone"} is calling`,
    body: "Tap to answer",
    tag: `call-${id}`,
    url: "/",
  }).catch(() => {});

  const res = await db.execute({ sql: "SELECT * FROM calls WHERE id = ?", args: [id] });
  return c.json({ call: res.rows[0] }, 201);
});

/** Any call currently ringing for me — the callee-side poll that surfaces
 * an incoming-call screen. At most one is meaningful at a time; returns
 * the oldest if somehow more than one is ringing. */
callRoutes.get("/calls/incoming", async (c) => {
  const user = c.get("user");
  const res = await db.execute({
    sql: `SELECT c.*, u.name as caller_name FROM calls c JOIN users u ON u.id = c.caller_id
          WHERE c.callee_id = ? AND c.status = 'ringing' ORDER BY c.created_at ASC LIMIT 1`,
    args: [user.sub],
  });
  return c.json({ call: res.rows[0] ?? null });
});

callRoutes.get("/calls/:id", async (c) => {
  const user = c.get("user");
  const call = await loadOwnedCall(c.req.param("id"), user.sub);
  if (!call) return c.json({ error: "not_found" }, 404);
  return c.json({ call });
});

callRoutes.post("/calls/:id/accept", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const call = await loadOwnedCall(id, user.sub);
  if (!call) return c.json({ error: "not_found" }, 404);
  if (call.callee_id !== user.sub) return c.json({ error: "forbidden" }, 403);
  if (call.status !== "ringing") return c.json({ error: "not_ringing", message: "This call is no longer ringing" }, 409);

  await db.execute({
    sql: "UPDATE calls SET status = 'accepted', answered_at = datetime('now') WHERE id = ?",
    args: [id],
  });
  const res = await db.execute({ sql: "SELECT * FROM calls WHERE id = ?", args: [id] });
  return c.json({ call: res.rows[0] });
});

const endSchema = z.object({
  // "declined": callee rejected while still ringing. "missed": caller gave
  // up waiting. "ended": either side hung up an accepted call.
  reason: z.enum(["declined", "missed", "ended"]),
});

callRoutes.post("/calls/:id/end", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const call = await loadOwnedCall(id, user.sub);
  if (!call) return c.json({ error: "not_found" }, 404);
  if (call.status === "ended" || call.status === "declined" || call.status === "missed" || call.status === "failed") {
    const res = await db.execute({ sql: "SELECT * FROM calls WHERE id = ?", args: [id] });
    return c.json({ call: res.rows[0] });
  }
  const parsed = endSchema.safeParse(await c.req.json().catch(() => ({})));
  const reason = parsed.success ? parsed.data.reason : "ended";
  const status = call.status === "ringing" ? (reason === "declined" ? "declined" : "missed") : "ended";

  const durationExpr =
    status === "ended"
      ? ", duration_seconds = CAST((julianday('now') - julianday(answered_at)) * 86400 AS INTEGER)"
      : "";
  await db.execute({
    sql: `UPDATE calls SET status = ?, ended_at = datetime('now')${durationExpr} WHERE id = ?`,
    args: [status, id],
  });
  const res = await db.execute({ sql: "SELECT * FROM calls WHERE id = ?", args: [id] });
  return c.json({ call: res.rows[0] });
});

// ---------------------------------------------------------------------------
// Cloudflare Realtime negotiation proxy — only meaningful when the active
// provider is "cloudflare"; keeps the App Secret server-side (see
// ../calls/cloudflare.ts). No-ops (with a clear error) for every other
// provider so the client can treat this uniformly and just show a friendly
// message when a provider isn't actually wired up yet.
// ---------------------------------------------------------------------------

function callsProviderError(err: unknown): { error: string; message: string } {
  if (err instanceof CloudflareCallsNotConfiguredError) {
    return { error: "provider_not_configured", message: "Calling isn't set up yet — ask an admin to add call credentials" };
  }
  if (err instanceof CloudflareCallsApiError) {
    return { error: "provider_error", message: "Couldn't connect the call. Please try again." };
  }
  return { error: "provider_error", message: "Couldn't connect the call. Please try again." };
}

const publishSchema = z.object({ sdp: z.string().min(1) });

/** Publishes this participant's mic into a fresh Realtime session and
 * records the session id against whichever side of the call they're on. */
callRoutes.post("/calls/:id/publish", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const call = await loadOwnedCall(id, user.sub);
  if (!call) return c.json({ error: "not_found" }, 404);
  if (call.provider !== "cloudflare") return c.json({ error: "wrong_provider" }, 400);
  const parsed = publishSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);

  try {
    const offer: SdpDescription = { type: "offer", sdp: parsed.data.sdp };
    const { sessionId, answer } = await createCallSession(offer);
    // Assume a fresh single-audio-track offer's one m-line is mid "0" —
    // true for the client wiring this ships with (one addTrack call
    // before createOffer); if a future client adds other tracks first,
    // this needs to read the actual mid back out of the offer instead.
    await nameLocalAudioTrack(sessionId, "0").catch(() => {});

    const column = call.caller_id === user.sub ? "caller_session_id" : "callee_session_id";
    await db.execute({ sql: `UPDATE calls SET ${column} = ? WHERE id = ?`, args: [sessionId, id] });

    return c.json({ sessionId, answer });
  } catch (err) {
    return c.json(callsProviderError(err), 502);
  }
});

/** Pulls the other participant's audio into my session — call once both
 * sides have published (poll GET /calls/:id until both *_session_id are
 * set). May come back with a fresh offer that needs answering via
 * /renegotiate below. */
callRoutes.post("/calls/:id/pull-remote", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const call = await loadOwnedCall(id, user.sub);
  if (!call) return c.json({ error: "not_found" }, 404);
  if (call.provider !== "cloudflare") return c.json({ error: "wrong_provider" }, 400);

  const mySessionId = call.caller_id === user.sub ? call.caller_session_id : call.callee_session_id;
  const theirSessionId = call.caller_id === user.sub ? call.callee_session_id : call.caller_session_id;
  if (!mySessionId || !theirSessionId) {
    return c.json({ error: "not_ready", message: "Both sides need to publish before pulling audio" }, 409);
  }

  try {
    const result = await pullRemoteAudioTrack(mySessionId as string, theirSessionId as string, "audio");
    return c.json(result);
  } catch (err) {
    return c.json(callsProviderError(err), 502);
  }
});

const renegotiateSchema = z.object({ sdp: z.string().min(1) });

callRoutes.post("/calls/:id/renegotiate", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const call = await loadOwnedCall(id, user.sub);
  if (!call) return c.json({ error: "not_found" }, 404);
  if (call.provider !== "cloudflare") return c.json({ error: "wrong_provider" }, 400);
  const parsed = renegotiateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);

  const mySessionId = call.caller_id === user.sub ? call.caller_session_id : call.callee_session_id;
  if (!mySessionId) return c.json({ error: "not_ready" }, 409);

  try {
    await renegotiateCallSession(mySessionId as string, { type: "answer", sdp: parsed.data.sdp });
    return c.json({ ok: true });
  } catch (err) {
    return c.json(callsProviderError(err), 502);
  }
});
