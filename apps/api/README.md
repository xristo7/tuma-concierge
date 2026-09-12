# tuma-api

Hono API for Tuma Concierge. Real order lifecycle, auth, rider matching, MoMo
escrow, and chat — backed by Turso (libsql) over HTTP, so the same code runs
in Node (local dev) and as a Cloudflare Worker (`src/worker.ts`) unchanged.

## Local

```bash
pnpm install
cp .env.example .env.local   # fill in JWT_SECRET and TURSO_DATABASE_URL/TURSO_AUTH_TOKEN
pnpm --filter api migrate    # creates tables
pnpm --filter api seed       # demo customer/rider/admin (password: password123)
pnpm --filter api dev        # http://localhost:10000
```

No local-file DB fallback — always talks to a real Turso database. For local dev without
touching staging, run `turso dev` and point `TURSO_DATABASE_URL` at it.

## Endpoints

See `GET /v1` for the full live list. Highlights:

- **Auth**: `POST /v1/auth/register`, `POST /v1/auth/login`, `GET /v1/auth/me`
- **Lists**: `POST /v1/lists`, `GET /v1/lists/recent`, `GET /v1/lists/:id`
- **Orders** (stage machine: Create → Match → Fund → Shop → Substitute → Approve → Deliver → Handover → Settle):
  `POST /v1/orders`, `GET /v1/orders/:id`, `POST /v1/orders/:id/match`,
  `POST /v1/orders/:id/fund`, `POST /v1/orders/:id/substitutions`,
  `POST /v1/orders/:id/substitutions/:subId/decision`,
  `POST /v1/orders/:id/deliver`, `POST /v1/orders/:id/handover`,
  `POST /v1/orders/:id/settle`
- **Chat**: `GET|POST /v1/orders/:id/chat`
- **Payments**: `GET /v1/payments/:id/refresh` (polls MoMo status),
  `POST /v1/payments/momo/callback` (webhook)
- **Riders**: `POST /v1/riders/apply`, `POST /v1/riders/status`,
  `GET /v1/riders/me`, `GET /v1/riders/me/orders`
- **Admin** (mock manual KYC — no real document verification integration):
  `GET /v1/admin/riders`, `POST /v1/admin/riders/:userId/verify`

## MoMo (escrow funding + rider payout)

Real MTN MoMo Open API integration (`src/momo/client.ts`), defaults to the
**sandbox** environment — no real money moves until you switch
`MOMO_TARGET_ENV=production` with real MTN merchant credentials, which you
must obtain yourself (MTN business approval required; this repo can't do
that for you).

To test against the free sandbox:

1. Create a developer account at https://momodeveloper.mtn.com/, subscribe
   to Collections + Disbursements, copy the subscription key(s).
2. Set `MOMO_SUBSCRIPTION_KEY` in `.env.local`.
3. Run `pnpm --filter api exec tsx src/momo/provision-sandbox.ts` — prints
   `MOMO_API_USER` / `MOMO_API_KEY` to add to `.env.local`.
4. Fund an order (`POST /v1/orders/:id/fund`) with a sandbox test MSISDN,
   then poll `GET /v1/payments/:id/refresh` until `status: "successful"`.

## Cloudflare Workers (`tuma-api`) — primary deploy target

```bash
pnpm --filter api deploy   # wrangler deploy
```

Secrets via `wrangler secret put <NAME>`: `JWT_SECRET`, `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, MoMo credentials. Non-secret vars live in `wrangler.jsonc`. See
`infra/CLOUDFLARE.md` for the full picture (including known bundling gotchas) and
`infra/ENV.md` for the env name matrix.

Do not commit secrets. `render.yaml` / the old Render service are kept for reference only.
