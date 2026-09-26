# Env matrix (names only)

Per environment: `local` | `preview` | `staging` | `prod`

## Database
- `DATABASE_URL`

## MoMo (MTN / Airtel)
- `MOMO_BASE_URL`
- `MOMO_SUBSCRIPTION_KEY`
- `MOMO_API_USER`
- `MOMO_API_KEY`
- `MOMO_TARGET_ENV` (`sandbox` | `production`)
- `MOMO_CALLBACK_URL`

## Maps
- `MAPS_API_KEY` (server)
- Public map key only if required; restrict by HTTP referrer

## Storage (R2)
- `RIDER_DOCS` Worker R2 binding (private rider, order, chat, restaurant, and merchant KYC files)
- Optional S3-compatible keys only if a non-Worker process must access the bucket

## WebRTC TURN
- `TURN_URLS`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

## Push
- `PUSH_VAPID_PUBLIC_KEY`
- `PUSH_VAPID_PRIVATE_KEY`
- `PUSH_SUBJECT`

## App
- `JWT_SECRET` / `SESSION_SECRET`
- `CREDENTIALS_ENCRYPTION_KEY` (required to encrypt provider credentials and merchant settlement destinations)
- `CORS_ORIGINS`

Do not paste secret values into chat, issues, or commits.
