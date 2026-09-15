/** 6-digit OTP codes for onboarding verification — short-lived and
 * rate-limited, so a fast hash is enough here (no need for bcrypt's
 * deliberate slowness). Works unchanged on Node and Workers via the
 * standard Web Crypto `crypto.subtle` global. */

import { randomInt } from "../lib/random.js";

export function generateCode(): string {
  return String(100000 + randomInt(900000));
}

/** Long opaque token for the one-click "Verify Email Address" link — unlike
 * the 6-digit code, this is exposed with no rate limiting on the click path
 * itself, so it needs to be unguessable on its own. */
export function generateLinkToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Keyed hash, not a bare digest. A 6-digit code has only 900,000 possible
 * values, so a plain SHA-256 of one is reversible by anybody who can read
 * the table and spend a second building a lookup of all 900k digests. An
 * HMAC under a key that lives outside the database makes those stored
 * hashes useless on their own.
 *
 * The key is `OTP_PEPPER` when set, otherwise it's derived from JWT_SECRET
 * with a label so the two uses can't be confused for one another — that
 * keeps this working without anyone having to provision a new secret first.
 */
function pepper(): string {
  const dedicated = process.env.OTP_PEPPER;
  if (dedicated) return dedicated;
  const fallback = process.env.JWT_SECRET;
  if (!fallback) {
    throw new Error("Neither OTP_PEPPER nor JWT_SECRET is set — cannot hash verification codes.");
  }
  return `otp-hash:${fallback}`;
}

export async function hashCode(code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compares two hex digests without leaking, through how long the comparison
 * takes, how much of a guess was right. `===` on strings bails at the first
 * differing character, which over many attempts tells an attacker they're
 * getting warmer. Both inputs here are fixed-length hashes, so the length
 * check gives nothing away.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
