-- Escrow payouts now land in an in-app rider wallet instead of going
-- straight to mobile money at Settle — riders withdraw from it whenever
-- they want. Cash-rail jobs never touch the wallet since the rider already
-- collected cash in person.

ALTER TABLE riders ADD COLUMN wallet_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS wallet_withdrawals (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'momo',
  provider_ref TEXT,
  msisdn TEXT,
  network TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_rider ON wallet_withdrawals(rider_id);
