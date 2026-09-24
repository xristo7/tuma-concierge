-- Lets a rider top their own wallet back up via mobile money — needed once
-- "deposit" mode (see 0046_rider_cash_dues.sql's superseding comment in
-- code: apps/api/src/lib/monetization.ts isCashDepositOk) can block a
-- rider from taking new jobs until their balance is back at the required
-- reserve. Same shape as the customer-side wallet_topups table.
CREATE TABLE IF NOT EXISTS rider_wallet_topups (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  msisdn TEXT,
  network TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rider_wallet_topups_rider ON rider_wallet_topups(rider_id);
