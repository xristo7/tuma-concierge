# tuma-api (bootstrap)

Minimal Hono API for Render free staging. Health/bootstrap only — no auth, orders, or MoMo yet.

## Local

```bash
pnpm install
pnpm --filter api dev
# GET http://localhost:10000/health
```

## Render (`tuma-api-staging`)

| | |
|--|--|
| **Root** | repo root |
| **Build** | `corepack enable && pnpm install && pnpm --filter api build` |
| **Start** | `node apps/api/dist/index.js` |
| **Health** | `GET /health` |
| **Port** | Render `PORT` (app defaults to `10000` if unset) |

### Env (names only)

- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — reserved; not wired in bootstrap
- `CORS_ORIGINS` — comma-separated; defaults include customer/rider staging URLs
- `NODE_VERSION=22`

Do not commit secrets.
