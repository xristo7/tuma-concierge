# Tuma Concierge — Runbook

Command reference for local dev, build, and deploy. Generated from the current repo state (`README.md`, `FRONTEND.md`, `apps/api/README.md`, `infra/DEPLOY.md`, `infra/STAGING.md`) on 2026-09-12.

Prereqs: Node ≥ 22, pnpm (`corepack enable` will get you `pnpm@9.15.0` per `package.json`).

---

## 1. Install

From the monorepo root:

```bash
corepack enable
pnpm install
```

## 2. Environment files

Each frontend app needs a local env file:

```bash
cp apps/customer/.env.example apps/customer/.env.local
cp apps/rider/.env.example apps/rider/.env.local
```

Set in both:

```
NEXT_PUBLIC_API_URL=http://localhost:10000
```

(Points at the local API below. Swap for `https://tuma-api-staging.onrender.com` to hit staging instead.)

The API (`apps/api`) is a real backend now — auth, orders lifecycle, matching, MoMo escrow, chat,
rider verification — backed by Turso (libsql), falling back to a local SQLite file
(`apps/api/local.db`) with zero setup. Copy `apps/api/.env.example` to `.env.local` and set at
least `JWT_SECRET`. Full env names for every stage are in `infra/ENV.md` — never commit real values.

## 3. Local dev

```bash
cp apps/api/.env.example apps/api/.env.local   # set JWT_SECRET
pnpm --filter api migrate    # creates tables (local.db by default)
pnpm --filter api seed       # demo customer/rider/admin, password: password123
```

Run each in its own terminal:

```bash
pnpm --filter api dev        # Hono API      -> http://localhost:10000
pnpm --filter customer dev   # Next.js app    -> http://localhost:3000
pnpm --filter rider dev      # Next.js app    -> http://localhost:3001
```

Quick checks once the API is up:

```bash
curl http://localhost:10000/health
curl -X POST http://localhost:10000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+256700000001","password":"password123"}'
```

See `apps/api/README.md` for the full endpoint list and how to test the MoMo escrow flow against
the free sandbox (no real money — going live needs your own MTN merchant credentials).

Root-level shortcuts (same thing, from `package.json`):

```bash
pnpm dev:api
pnpm dev:customer
pnpm dev:rider
```

> `workers/api` is a legacy Cloudflare Worker scaffold — leave it alone; `apps/api` is the real backend now.

## 4. Build

```bash
pnpm --filter api build        # apps/api/dist/index.js
pnpm --filter customer build   # apps/customer/.next
pnpm --filter rider build      # apps/rider/.next
```

Root-level shortcuts:

```bash
pnpm build:api
pnpm build:customer
pnpm build:rider
```

### Standalone start (what Render actually runs)

The Next.js apps build with `output: "standalone"`. After building, copy static assets into the standalone tree, then start:

```bash
# customer
mkdir -p apps/customer/.next/standalone/apps/customer/.next
cp -r apps/customer/public apps/customer/.next/standalone/apps/customer/
cp -r apps/customer/.next/static apps/customer/.next/standalone/apps/customer/.next/
node apps/customer/.next/standalone/apps/customer/server.js

# rider
mkdir -p apps/rider/.next/standalone/apps/rider/.next
cp -r apps/rider/public apps/rider/.next/standalone/apps/rider/
cp -r apps/rider/.next/static apps/rider/.next/standalone/apps/rider/.next/
node apps/rider/.next/standalone/apps/rider/server.js

# api
node apps/api/dist/index.js
```

(Render sets `PORT` automatically; Next standalone and the Hono API both read `process.env.PORT`.)

## 5. Deploy (Render + Turso)

Deploy is Blueprint-driven from the root `render.yaml` — three free-tier Render Web Services:

| Service | Build | Start | Health |
|---|---|---|---|
| `tuma-api-staging` | `corepack enable && pnpm install && pnpm --filter api build && pnpm --filter api migrate` | `node apps/api/dist/index.js` | `/health` |
| `tuma-customer-staging` | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter customer build && <copy static, see above>` | `node apps/customer/.next/standalone/apps/customer/server.js` | `/` |
| `tuma-rider-staging` | same pattern with `rider` | `node apps/rider/.next/standalone/apps/rider/server.js` | `/` |

Steps:

```text
1. Merge changes to main (Render auto-deploys via autoDeploy: true).
2. Or: Render Dashboard -> New -> Blueprint -> select xristo7/tuma-concierge -> confirm free plan only.
3. Set env vars in the Render dashboard (never commit them):
   - tuma-api-staging: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, CORS_ORIGINS,
     and MOMO_* (sandbox by default — see apps/api/README.md) once escrow testing is needed
   - tuma-customer-staging / tuma-rider-staging: NEXT_PUBLIC_API_URL
```

Database: Turso `tuma-staging` (free tier) is already live per `infra/STAGING.md` — `0001_init` applied, 19 tables.

Currently live (per `infra/STAGING.md`):
- `tuma-api-staging` → https://tuma-api-staging.onrender.com (`GET /health`)
- `tuma-customer-staging`, `tuma-rider-staging` on Render

Blocked / not yet live: paid Render tiers, Cloudflare R2/Workers (paid), MoMo live mode, paid TURN, production environment (waiting on product sign-off).

## 6. Lint / typecheck

```bash
pnpm -r lint
```

---

## Quick preview (fastest path to seeing it in a browser)

```bash
corepack enable
pnpm install
pnpm --filter api dev &
pnpm --filter customer dev &
pnpm --filter rider dev &
```

Then open:
- Customer app: http://localhost:3000
- Rider app: http://localhost:3001
- API health: http://localhost:10000/health
