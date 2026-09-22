/**
 * "webrtc_p2p" — direct browser-to-browser WebRTC, no media-relay service
 * in between. Free public STUN gets most calls connected; a free-tier or
 * self-hosted TURN server (admin-configured, optional) is the fallback for
 * the minority of connections that can't punch through both sides' NAT
 * directly. Unlike ../calls/cloudflare.ts, this file doesn't talk to any
 * external API — it just resolves what ICE server list the client should
 * use, and the actual offer/answer exchange happens over plain columns on
 * the calls row (see ../calls/routes.ts /offer and /answer, and
 * packages/shared/src/call-engine.ts for the client-side negotiation).
 */

import { getCallCredential } from "./credentials.js";

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

// Cloudflare and Google both run STUN servers free, with no account or
// quota — this alone is enough for the majority of direct connections.
const FREE_STUN_SERVERS: IceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

export async function resolveP2PIceServers(): Promise<IceServer[]> {
  const [turnUrls, turnUsername, turnCredential] = await Promise.all([
    getCallCredential("webrtc_p2p", "turnUrls"),
    getCallCredential("webrtc_p2p", "turnUsername"),
    getCallCredential("webrtc_p2p", "turnCredential"),
  ]);

  const servers = [...FREE_STUN_SERVERS];
  if (turnUrls) {
    const urls = turnUrls
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      servers.push({ urls, username: turnUsername, credential: turnCredential });
    }
  }
  return servers;
}
