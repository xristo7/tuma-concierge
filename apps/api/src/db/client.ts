import { createClient, type Client } from "@libsql/client/web";

/**
 * Uses the HTTP-only libsql client so this module runs unchanged in Node
 * (local dev, migrate/seed scripts) and on Cloudflare Workers (no native
 * bindings, no local `file:` mode). Always points at a real Turso database —
 * for local dev without touching staging, run `turso dev` and point
 * TURSO_DATABASE_URL at it (see apps/api/README.md).
 *
 * Built lazily (on first query, not at import time) because on Workers the
 * `env` bindings — which worker.ts copies onto `process.env` — are only
 * available once a request comes in, not at module-load/cold-start time.
 */
function buildClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Copy .env.example to .env.local (or set the Worker var/secret) — see apps/api/README.md.",
    );
  }

  return createClient({ url, authToken });
}

let cached: Client | null = null;

function client(): Client {
  if (!cached) cached = buildClient();
  return cached;
}

export const db: Client = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const value = Reflect.get(client(), prop, receiver);
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
