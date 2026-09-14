/** 6-digit OTP codes for onboarding verification — short-lived and
 * rate-limited, so a fast SHA-256 hash is enough (no need for bcrypt's
 * deliberate slowness here). Works unchanged on Node and Workers via the
 * standard Web Crypto `crypto.subtle` global. */

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
