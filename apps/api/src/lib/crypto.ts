/**
 * AES-256-GCM encrypt/decrypt for secrets we store at rest (currently:
 * admin-entered payment aggregator API credentials — see
 * ../payments/credentials.ts). Everything else sensitive in this codebase
 * so far has been an env var the process never persists (see YO_API_*,
 * FLUTTERWAVE_SECRET_KEY); this is the first thing we actually write to the
 * database, so it needs real encryption rather than the OTP pepper's
 * keyed-hash pattern (../verify/otp.ts), which is one-way and can't be
 * decrypted back into a usable API key.
 *
 * CREDENTIALS_ENCRYPTION_KEY may be any length/format (a passphrase, a
 * base64 blob, whatever an admin generates) — it's SHA-256'd down to a
 * fixed 32-byte key rather than requiring a specific encoding.
 */

import { createHash, randomBytes, webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

function masterKeyMaterial(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(raw).digest();
}

async function importKey(): Promise<CryptoKey> {
  return subtle.importKey("raw", masterKeyMaterial(), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Returns `base64(iv):base64(ciphertext+tag)` — the IV is random per call
 * and safe to store alongside the ciphertext (it's not the secret). */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = randomBytes(12);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${Buffer.from(iv).toString("base64")}:${Buffer.from(ciphertext).toString("base64")}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  const [ivB64, dataB64] = stored.split(":");
  if (!ivB64 || !dataB64) throw new Error("Malformed encrypted credential");
  const key = await importKey();
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");
  const plaintext = await subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export function isCredentialsEncryptionConfigured(): boolean {
  return !!process.env.CREDENTIALS_ENCRYPTION_KEY;
}
