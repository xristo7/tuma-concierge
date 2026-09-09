# Deploy (Render + Turso)

## Frontend (PR / main)

Blueprint: root `render.yaml`

| Service | Type | Plan | Notes |
|---------|------|------|-------|
| `tuma-customer-staging` | Web (Node 22) | free | `pnpm --filter customer build` + standalone start |
| `tuma-rider-staging` | Web (Node 22) | free | `pnpm --filter rider build` + standalone start |
| `tuma-api-staging` | Web | free | **pending** Backend Node entry — not in blueprint yet |

Env (set in Render dashboard, never commit):
- `NEXT_PUBLIC_API_URL` — API base URL once `tuma-api-staging` is live

## Database

- Turso DB `tuma-staging` (free) — Ship creates after Turso MCP auth
- Secrets: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` on API only

## Apply blueprint

1. Merge FE scaffold (+ this `render.yaml`)
2. Render Dashboard → New → Blueprint → select `xristo7/tuma-concierge`
3. Confirm free plan services only
