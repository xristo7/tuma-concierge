# Tuma Concierge

Uganda boda shopping concierge — customers post shopping lists; verified riders buy and deliver.

## Stack (staging, free-tier)

- **Monorepo** `xristo7/tuma-concierge`
- **Apps:** `apps/customer`, `apps/rider` (Next.js App Router → **Render** Node 22 Web Services, `output: standalone`)
- **API:** owned by Backend/Ship (`tuma-api-staging` on Render; leave `workers/api` alone for now)
- **DB:** Turso (`tuma-staging`)
- **Shared:** `packages/shared` (`@tuma/shared`)

See **[FRONTEND.md](./FRONTEND.md)** for pnpm filters, standalone start paths, and Render notes.

## Layout

```
apps/customer/   # customer web / PWA shell
apps/rider/      # rider web / PWA shell
workers/api/     # legacy CF worker scaffold — leave alone
packages/shared/ # OrderStage, PaymentRail, API client for the real backend
infra/           # env matrix, deploy notes
```

## Environments

| Env | Services | DB |
|-----|----------|-----|
| staging | `tuma-api-staging`, `tuma-customer-staging`, `tuma-rider-staging` (Render) | Turso `tuma-staging` |
| production | *blocked until Sharon OK* | *blocked* |

## Secrets

Never commit `.env` or secrets. Use Render env / GitHub Actions secrets. See `infra/ENV.md`.
