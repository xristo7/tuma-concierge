# Staging (free-first)

**Stack:** Cloudflare Workers (host, all three services) + Turso (DB). Previously Render —
kept as reference/rollback (`render.yaml`), no longer the active deploy target. The earlier
"R2 billing wall" pause turned out to be specific to R2; Workers + assets deploy fine on the
free tier and are what we actually use now — no R2 involved.

See **[CLOUDFLARE.md](./CLOUDFLARE.md)** for full deploy instructions, required secrets, and
known gotchas (sharp bundling, `NEXT_PRIVATE_MINIMAL_MODE`, Node 22 requirement).

## Live

- [x] Private repo `xristo7/tuma-concierge`
- [x] Turso DB `tuma-staging` (free) — `0001_init` applied (19 tables)
- [x] `tuma-api` — real backend (auth, orders, matching, MoMo escrow, chat, rider
      verification) — https://tuma-api.doxalight-inc.workers.dev (`GET /health`)
- [x] `tuma-customer` — https://tuma-customer.doxalight-inc.workers.dev
- [x] `tuma-rider` — https://tuma-rider.doxalight-inc.workers.dev
- [ ] `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` secrets on the `tuma-api` Worker (carry over
      from the old Render service — see CLOUDFLARE.md). Until set, DB-backed endpoints
      return a clean 500; `/health` is unaffected.
- [ ] GH Actions deploy workflow (currently manual `wrangler deploy`)

## API

- Path: `apps/api` (not `workers/api`, which is an unrelated legacy scaffold)
- Deploy: `pnpm --filter api deploy` (`wrangler deploy`)
- Health: `GET /health`
- Secrets (via `wrangler secret put`): `JWT_SECRET` (set), `TURSO_DATABASE_URL`,
  `TURSO_AUTH_TOKEN` (not yet set), MoMo sandbox creds (optional)

## Blocked / wait

- Neon paid, paid TURN, production
- MoMo *live* mode — sandbox integration is done; going live needs MTN merchant approval +
  real credentials as Worker secrets

## Env (names only)

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `NEXT_PUBLIC_API_URL` — baked in at build time via each app's `.env.production`
- MoMo / maps / TURN / push — see `infra/ENV.md`
