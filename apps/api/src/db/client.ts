import { createClient, type Client } from "@libsql/client";

/**
 * Falls back to a local file DB when Turso env vars are absent, so `pnpm dev`
 * and tests work with zero setup. Staging/production set TURSO_DATABASE_URL
 * (+ TURSO_AUTH_TOKEN) in Render.
 */
function buildClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    return createClient({ url, authToken });
  }

  return createClient({ url: "file:./local.db" });
}

export const db = buildClient();
