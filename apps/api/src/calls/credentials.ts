/**
 * Admin-editable API credentials for the voice-call providers, stored
 * encrypted in call_credentials (same table shape and same crypto helper
 * as ../payments/credentials.ts — see ../db/migrations/0040_calls.sql and
 * ../lib/crypto.ts). "mock" needs no credentials at all.
 */

import { db } from "../db/client.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import type { CallProviderIdentity } from "../lib/settings.js";

export type CredentialFieldDef = {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  envVar: string;
};

export const CALL_PROVIDER_CREDENTIAL_FIELDS: Record<Exclude<CallProviderIdentity, "mock">, CredentialFieldDef[]> = {
  cloudflare: [
    {
      key: "appId",
      label: "Realtime App ID",
      secret: false,
      required: true,
      envVar: "CALLS_CLOUDFLARE_APP_ID",
      helpText: "From the Realtime (Calls) app you create in the Cloudflare dashboard.",
    },
    {
      key: "appSecret",
      label: "Realtime App Secret",
      secret: true,
      required: true,
      envVar: "CALLS_CLOUDFLARE_APP_SECRET",
    },
  ],
  // Direct browser-to-browser WebRTC — no media-relay service, so no
  // required fields at all; free public STUN (hardcoded in
  // ../calls/webrtc-p2p.ts) already gets most calls connected. These are
  // purely optional, for a TURN relay to fall back to when a direct
  // connection can't punch through both sides' NAT (common on carrier
  // mobile networks) — a free-tier TURN service, or a self-hosted coturn.
  webrtc_p2p: [
    {
      key: "turnUrls",
      label: "TURN server URL(s)",
      secret: false,
      required: false,
      envVar: "CALLS_P2P_TURN_URLS",
      placeholder: "turn:relay.example.com:3478",
      helpText: "Comma-separated if more than one. Leave blank to rely on STUN alone (works for most calls).",
    },
    { key: "turnUsername", label: "TURN username", secret: false, required: false, envVar: "CALLS_P2P_TURN_USERNAME" },
    { key: "turnCredential", label: "TURN credential", secret: true, required: false, envVar: "CALLS_P2P_TURN_CREDENTIAL" },
  ],
  // Not wired up to a real SDK yet — fields are here so an admin can save
  // credentials in advance, but selecting this provider currently returns
  // a "not implemented" error from ../calls/service.ts until it is.
  twilio: [
    { key: "accountSid", label: "Account SID", secret: false, required: true, envVar: "CALLS_TWILIO_ACCOUNT_SID" },
    { key: "authToken", label: "Auth token", secret: true, required: true, envVar: "CALLS_TWILIO_AUTH_TOKEN" },
    { key: "apiKeySid", label: "API key SID", secret: false, required: false, envVar: "CALLS_TWILIO_API_KEY_SID" },
    { key: "apiKeySecret", label: "API key secret", secret: true, required: false, envVar: "CALLS_TWILIO_API_KEY_SECRET" },
  ],
  agora: [
    { key: "appId", label: "App ID", secret: false, required: true, envVar: "CALLS_AGORA_APP_ID" },
    { key: "appCertificate", label: "App certificate", secret: true, required: true, envVar: "CALLS_AGORA_APP_CERTIFICATE" },
  ],
};

type Row = { value: string };

async function readStored(provider: CallProviderIdentity, field: string): Promise<string | undefined> {
  const res = await db.execute({
    sql: "SELECT value FROM call_credentials WHERE provider = ? AND field = ?",
    args: [provider, field],
  });
  const row = res.rows[0] as unknown as Row | undefined;
  if (!row) return undefined;
  try {
    return await decryptSecret(row.value);
  } catch {
    return undefined;
  }
}

export async function getCallCredential(provider: CallProviderIdentity, field: string): Promise<string | undefined> {
  if (provider === "mock") return undefined;
  const stored = await readStored(provider, field);
  if (stored) return stored;
  const def = CALL_PROVIDER_CREDENTIAL_FIELDS[provider].find((f) => f.key === field);
  return def?.envVar ? process.env[def.envVar] || undefined : undefined;
}

export async function isCallProviderConfigured(provider: CallProviderIdentity): Promise<boolean> {
  if (provider === "mock") return true;
  const required = CALL_PROVIDER_CREDENTIAL_FIELDS[provider].filter((f) => f.required);
  const values = await Promise.all(required.map((f) => getCallCredential(provider, f.key)));
  return values.every((v) => !!v);
}

export async function callCredentialFieldStatus(provider: Exclude<CallProviderIdentity, "mock">) {
  const fields = CALL_PROVIDER_CREDENTIAL_FIELDS[provider];
  return Promise.all(
    fields.map(async (f) => ({
      key: f.key,
      label: f.label,
      secret: f.secret,
      required: f.required,
      placeholder: f.placeholder,
      helpText: f.helpText,
      set: !!(await getCallCredential(provider, f.key)),
    })),
  );
}

export async function saveCallCredentials(
  provider: Exclude<CallProviderIdentity, "mock">,
  fields: Record<string, string>,
): Promise<string[]> {
  const validKeys = new Set(CALL_PROVIDER_CREDENTIAL_FIELDS[provider].map((f) => f.key));
  const changed: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!validKeys.has(key)) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const encrypted = await encryptSecret(trimmed);
    await db.execute({
      sql: `INSERT INTO call_credentials (provider, field, value, updated_at) VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(provider, field) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [provider, key, encrypted],
    });
    changed.push(key);
  }
  return changed;
}

export async function clearCallCredential(provider: Exclude<CallProviderIdentity, "mock">, field: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM call_credentials WHERE provider = ? AND field = ?", args: [provider, field] });
}
