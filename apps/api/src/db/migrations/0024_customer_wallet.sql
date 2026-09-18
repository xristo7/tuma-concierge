-- Customer wallet — closed-loop store credit (confirmed with the product
-- owner: top up and spend, no cash-out; refunds return to the wallet
-- instead of going back out to mobile money). wallet_balance lives on
-- users (there's no separate customers table) the same way riders got
-- wallet_balance added directly to `riders` in 0012_rider_wallet.sql.
ALTER TABLE users ADD COLUMN wallet_balance INTEGER NOT NULL DEFAULT 0;

-- One row per top-up attempt — mirrors wallet_withdrawals' shape (rider
-- side) so the same provider/provider_ref/status polling pattern applies.
CREATE TABLE IF NOT EXISTS wallet_topups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  method TEXT NOT NULL DEFAULT 'mobile_money' CHECK (method IN ('mobile_money', 'card')),
  msisdn TEXT,
  network TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallet_topups_user ON wallet_topups(user_id);

-- The running wallet_balance is a cache; this is the source of truth for
-- how it got there — every top-up, order payment, refund, or admin
-- adjustment, in order, so a customer's balance is always reconstructable
-- and auditable (a standard expectation for anything that holds a stored
-- balance, even a closed-loop one).
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('topup', 'order_payment', 'refund', 'adjustment')),
  amount INTEGER NOT NULL, -- positive = credit, negative = debit
  balance_after INTEGER NOT NULL,
  order_id TEXT REFERENCES orders(id),
  topup_id TEXT REFERENCES wallet_topups(id),
  note TEXT,
  actor_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);
