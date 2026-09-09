# Staging (free-first)

**Stack:** Render (host) + Turso (DB). Cloudflare Workers/R2 paused (R2 billing wall).

## Live

- [x] Private repo `xristo7/tuma-concierge`
- [ ] Turso DB `tuma-staging` (free) — MCP connect in progress
- [ ] Render `tuma-api-staging` (web service)
- [ ] Render `tuma-customer-staging`
- [ ] Render `tuma-rider-staging`
- [ ] GH Actions deploy stubs (Render + Turso secrets; never commit values)

## Blocked / wait

- Paid Render, CF R2/Workers paid, Neon paid, MoMo live, paid TURN, production

## Env (names only)

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `NEXT_PUBLIC_API_URL` / `API_URL` → Render API URL
- MoMo / maps / TURN / push — see `infra/ENV.md`
