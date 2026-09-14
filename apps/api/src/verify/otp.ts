/** 6-digit OTP codes for onboarding verification — short-lived and
 * rate-limited, so a fast SHA-256 hash is enough (no need for bcrypt's
 * deliberate slowness here). Works unchanged on Node and Workers via the
 * standard Web Crypto `crypto.subtle` global. */

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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

export async function hashCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
