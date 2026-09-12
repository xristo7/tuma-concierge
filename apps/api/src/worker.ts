import app from "./app.js";

/** Minimal local stand-in so we don't need @cloudflare/workers-types (which
 * conflicts with @types/node's DOM-lib globals) just for one field. */
type CfExecutionContext = { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };

/** Cloudflare Worker entry. `env` carries Worker vars/secrets — nodejs_compat
 * gives us a `process` global, so mirror them onto process.env once per
 * request and every existing `process.env.X` read in the app keeps working
 * unchanged. */
export default {
  fetch(request: Request, env: Record<string, string>, ctx: CfExecutionContext): Response | Promise<Response> {
    Object.assign(process.env, env);
    return app.fetch(request, env, ctx as never);
  },
};
