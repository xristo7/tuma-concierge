/**
 * Cloudflare Realtime SFU adapter — the first real (non-mock) voice-call
 * provider. See https://developers.cloudflare.com/realtime/sfu/https-api/.
 *
 * Realtime SFU only routes media between WebRTC sessions our own backend
 * creates and links together; it has no concept of "rooms" or "who's
 * calling whom" — that's ../calls/service.ts and ../calls/routes.ts. This
 * file is purely the thin HTTPS proxy to Cloudflare's own API, keeping the
 * App Secret server-side (never sent to a client).
 *
 * NOTE: this follows Cloudflare's documented request/response shapes as
 * closely as possible, but hasn't been exercised against a live Realtime
 * App from this environment (no way to place a real two-browser call
 * here) — verify against a real App ID/Secret before relying on it, and
 * watch this file first if calls connect signaling-wise but never carry
 * audio.
 */

import { getCallCredential } from "./credentials.js";

const API_BASE = "https://rtc.live.cloudflare.com/v1";

export class CloudflareCallsNotConfiguredError extends Error {
  constructor() {
    super("Cloudflare Realtime App ID/Secret aren't configured");
    this.name = "CloudflareCallsNotConfiguredError";
  }
}

export class CloudflareCallsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CloudflareCallsApiError";
    this.status = status;
  }
}

async function credentials(): Promise<{ appId: string; appSecret: string }> {
  const [appId, appSecret] = await Promise.all([
    getCallCredential("cloudflare", "appId"),
    getCallCredential("cloudflare", "appSecret"),
  ]);
  if (!appId || !appSecret) throw new CloudflareCallsNotConfiguredError();
  return { appId, appSecret };
}

async function callApi<T>(
  path: string,
  appId: string,
  appSecret: string,
  body: unknown,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const res = await fetch(`${API_BASE}/apps/${appId}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${appSecret}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CloudflareCallsApiError(res.status, (json as { errorDescription?: string }).errorDescription ?? res.statusText);
  }
  return json as T;
}

export type SdpDescription = { type: "offer" | "answer"; sdp: string };

/** Creates a new Realtime session for one call participant from their
 * WebRTC offer, returning the session id and Cloudflare's answer — this is
 * "publish my mic" for that participant. */
export async function createCallSession(offer: SdpDescription): Promise<{ sessionId: string; answer: SdpDescription }> {
  const { appId, appSecret } = await credentials();
  const res = await callApi<{ sessionId: string; sessionDescription: SdpDescription }>(
    "/sessions/new",
    appId,
    appSecret,
    { sessionDescription: offer },
  );
  return { sessionId: res.sessionId, answer: res.sessionDescription };
}

/** Registers this session's already-negotiated local audio track under a
 * stable name ("audio") so the other participant's session can find and
 * pull it — call right after createCallSession. `mid` is the m-line id
 * from the local RTCPeerConnection's own description (almost always "0"
 * for a fresh connection with a single audio track, but read it from the
 * actual local description rather than assuming). */
export async function nameLocalAudioTrack(sessionId: string, mid: string): Promise<void> {
  const { appId, appSecret } = await credentials();
  await callApi(`/sessions/${sessionId}/tracks/new`, appId, appSecret, {
    tracks: [{ location: "local", mid, trackName: "audio" }],
  });
}

/** Pulls the other participant's published audio track into this session
 * — "subscribe to the other side's mic". Cloudflare may need to
 * renegotiate this session to add the new inbound track, in which case it
 * returns a fresh offer the caller must answer and post back via
 * renegotiateCallSession. */
export async function pullRemoteAudioTrack(
  sessionId: string,
  remoteSessionId: string,
  remoteTrackName: string,
): Promise<{ requiresRenegotiation: boolean; offer?: SdpDescription }> {
  const { appId, appSecret } = await credentials();
  const res = await callApi<{ requiresImmediateRenegotiation: boolean; sessionDescription?: SdpDescription }>(
    `/sessions/${sessionId}/tracks/new`,
    appId,
    appSecret,
    { tracks: [{ location: "remote", sessionId: remoteSessionId, trackName: remoteTrackName }] },
  );
  return { requiresRenegotiation: !!res.requiresImmediateRenegotiation, offer: res.sessionDescription };
}

/** Completes a renegotiation Cloudflare asked for (see above) by posting
 * this session's answer back. */
export async function renegotiateCallSession(sessionId: string, answer: SdpDescription): Promise<void> {
  const { appId, appSecret } = await credentials();
  await callApi(`/sessions/${sessionId}/renegotiate`, appId, appSecret, { sessionDescription: answer }, "PUT");
}
