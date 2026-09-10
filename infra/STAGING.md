# Staging (free-first)

**Stack:** Render (host) + Turso (DB). Cloudflare Workers/R2 paused (R2 billing wall).

## Live

- [x] Private repo `xristo7/tuma-concierge`
- [x] Turso DB `tuma-staging` (free) — `0001_init` applied (19 tables)
- [x] API scaffold `apps/api` (Hono health/bootstrap) — see Render service
- [x] Render `tuma-customer-staging`
- [x] Render `tuma-rider-staging`
- [x] Render `tuma-api-staging` — https://tuma-api-staging.onrender.com (`GET /health`)
- [ ] GH Actions deploy stubs (Render + Turso secrets; never commit values)

## API (Ship)

- Path: `apps/api` (not `workers/api`)
- Build: `corepack enable && pnpm install && pnpm --filter api build`
- Start: `node apps/api/dist/index.js`
- Health: `GET /health`
- Env names: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CORS_ORIGINS`, `PORT`

## Blocked / wait

- Paid Render, CF R2/Workers paid, Neon paid, MoMo live, paid TURN, production
- Full API feature routes until Sharon product answers

## Env (names only)

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `NEXT_PUBLIC_API_URL` / `API_URL` → Render API URL
- MoMo / maps / TURN / push — see `infra/ENV.md`
