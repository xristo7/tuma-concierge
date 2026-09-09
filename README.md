# Tuma Concierge

Uganda boda shopping concierge — customers post shopping lists; verified riders buy and deliver.

## Stack (staging)

- **Monorepo** under `xristo7/tuma-concierge`
- **Apps:** `apps/customer`, `apps/rider` (Next.js → Cloudflare)
- **API:** `workers/api` (Cloudflare Worker)
- **DB:** Neon Postgres (staging)
- **Storage:** R2 bucket `tuma-staging`

## Layout

```
apps/customer/   # customer web / PWA
apps/rider/      # rider web / PWA
workers/api/     # API Worker
packages/shared/ # shared types & clients
infra/           # env matrix, deploy notes
```

## Environments

| Env | Workers | Neon | R2 |
|-----|---------|------|----|
| staging | `tuma-api-staging`, `tuma-customer-staging`, `tuma-rider-staging` | staging branch | `tuma-staging` |
| production | *blocked until Sharon OK* | *blocked* | *blocked* |

## Secrets

Never commit `.env` or secrets. Use Wrangler secrets / GitHub Actions secrets. See `infra/ENV.md`.
