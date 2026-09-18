import type { Context } from "hono";
import { db } from "../db/client.js";

/**
 * Rate limiting backed by the `rate_limits` table in D1.
 *
 * D1 is the right store rather than an in-memory map because Workers run each
 * request in whichever isolate happens to be free — an in-process counter
 * would be reset by the next cold start and wouldn't be shared between
 * colos, which is exactly the gap a distributed password-guessing attempt
 * walks through.
 *
 * Two shapes are offered:
 *   - `consume()`   — a fixed-window counter ("N per minute"), for volume.
 *   - `recordFailure()` / `checkLockout()` — progressive backoff, for
 *     credential guessing, where the point is to make attempt 50 expensive
 *     rather than to cap attempts per minute.
 */

export type LimitResult = { allowed: boolean; retryAfterSeconds: number };

const ALLOWED: LimitResult = { allowed: true, retryAfterSeconds: 0 };

/** SQLite `datetime('now')` → epoch seconds (UTC, space-separated, no "Z"). */
function sqliteMs(value: string): number {
  return new Date(`${value.replace(" ", "T")}Z`).getTime();
}

/** Keys derived from user input (a phone number, an email, an IP) are hashed
 * so the rate-limit table never becomes a browsable list of who has an
 * account here. Truncated to 32 hex chars — collisions are harmless, they'd
 * only ever merge two counters. */
export async function hashKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cloudflare sets this on every inbound request and it can't be spoofed by
 * the client (unlike X-Forwarded-For). Falls back to a constant off-Workers,
 * which collapses local dev onto a single shared bucket — fine for dev. */
export function clientIp(c: Context): string {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip") ?? "local";
}

/**
 * Fixed-window counter. Returns `allowed: false` once `limit` is exceeded
 * inside `windowSeconds`.
 *
 * Two requests racing can each read a stale count and both be let through —
 * acceptable, because the goal is stopping sustained abuse, not enforcing an
 * exact quota.
 */
export async function consume(key: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  const windowStart = `-${windowSeconds} seconds`;
  await db.execute({
    sql: `INSERT INTO rate_limits (key, count, window_start)
          VALUES (?, 1, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET
            count = CASE WHEN rate_limits.window_start <= datetime('now', ?) THEN 1 ELSE rate_limits.count + 1 END,
            window_start = CASE WHEN rate_limits.window_start <= datetime('now', ?) THEN datetime('now') ELSE rate_limits.window_start END`,
    args: [key, windowStart, windowStart],
  });

  const res = await db.execute({ sql: "SELECT count, window_start FROM rate_limits WHERE key = ?", args: [key] });
  const row = res.rows[0] as { count?: number; window_start?: string } | undefined;
  if (!row || (row.count ?? 0) <= limit) return ALLOWED;

  const elapsed = (Date.now() - sqliteMs(row.window_start as string)) / 1000;
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsed)) };
}

const FREE_ATTEMPTS = 5;
const BASE_LOCK_SECONDS = 60;
const MAX_LOCK_SECONDS = 60 * 60;
/** A quiet spell this long wipes the slate — so a legitimate person who
 * fumbled their password yesterday doesn't start today part-way to a lock. */
const FAILURE_MEMORY_SECONDS = 60 * 60;

/** Is this key currently locked out? Call before doing the expensive check
 * (a bcrypt compare), so a locked attacker costs us a single indexed read. */
export async function checkLockout(key: string): Promise<LimitResult> {
  const res = await db.execute({ sql: "SELECT locked_until FROM rate_limits WHERE key = ?", args: [key] });
  const lockedUntil = res.rows[0]?.locked_until as string | null | undefined;
  if (!lockedUntil) return ALLOWED;

  const remainingMs = sqliteMs(lockedUntil) - Date.now();
  if (remainingMs <= 0) return ALLOWED;
  return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

/**
 * Record a failed attempt and extend the lockout if there have been enough
 * of them. The delay doubles per failure past the free allowance — 1, 2, 4,
 * 8 … minutes — so a handful of typos cost nothing while an automated run
 * hits an hour-long wall within a dozen guesses.
 */
export async function recordFailure(key: string): Promise<void> {
  const memory = `-${FAILURE_MEMORY_SECONDS} seconds`;
  await db.execute({
    sql: `INSERT INTO rate_limits (key, count, window_start)
          VALUES (?, 1, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET
            count = CASE WHEN rate_limits.window_start <= datetime('now', ?) THEN 1 ELSE rate_limits.count + 1 END,
            window_start = datetime('now')`,
    args: [key, memory],
  });

  const res = await db.execute({ sql: "SELECT count FROM rate_limits WHERE key = ?", args: [key] });
  const count = (res.rows[0]?.count as number | undefined) ?? 1;
  if (count <= FREE_ATTEMPTS) return;

  const lockSeconds = Math.min(MAX_LOCK_SECONDS, BASE_LOCK_SECONDS * 2 ** (count - FREE_ATTEMPTS - 1));
  await db.execute({
    sql: `UPDATE rate_limits SET locked_until = datetime('now', ?) WHERE key = ?`,
    args: [`+${lockSeconds} seconds`, key],
  });
}

/** A successful sign-in clears the record — the person proved they're the
 * owner, so previous fumbles shouldn't count against their next session. */
export async function clearFailures(key: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM rate_limits WHERE key = ?", args: [key] });
}

/** Standard 429 body, so every caller reports throttling the same way. */
export function tooManyRequests(c: Context, result: LimitResult, message: string) {
  c.header("Retry-After", String(result.retryAfterSeconds));
  return c.json({ error: "rate_limited", message, retryAfterSeconds: result.retryAfterSeconds }, 429);
}

/**
 * Housekeeping for the two tables that grow with traffic. Run on a small
 * fraction of limited requests rather than on a schedule — there's no cron
 * on this Worker, and the cost is one delete on ~2% of auth calls.
 */
export async function sweepExpired(): Promise<void> {
  if (Math.random() > 0.02) return;
  try {
    await db.execute("DELETE FROM revoked_sessions WHERE expires_at < datetime('now')");
    await db.execute(
      "DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 day') AND (locked_until IS NULL OR locked_until < datetime('now'))",
    );
  } catch (err) {
    console.error("Rate-limit sweep failed:", err);
  }
}
