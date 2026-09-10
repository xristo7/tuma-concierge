# tuma-api (bootstrap + Home stubs)

Hono API for Render free staging.

- Health: `GET /health`
- Home stubs: see [docs/HOME_STUBS.md](./docs/HOME_STUBS.md) — **no MoMo/escrow**

## Local

```bash
pnpm install
pnpm --filter api dev
# GET http://localhost:10000/health
# GET http://localhost:10000/v1/home
```

## Render (`tuma-api-staging`)

| | |
|--|--|
| **Build** | `corepack enable && pnpm install && pnpm --filter api build` |
| **Start** | `node apps/api/dist/index.js` |
| **Health** | `GET /health` |

Env (names only): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CORS_ORIGINS`, `PORT`, `NODE_VERSION=22`.

Do not commit secrets.
