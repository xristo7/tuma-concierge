-- Multiple named wallets per customer (up to 5 total, enforced at the API
-- level in apps/api/src/wallet/routes.ts). Deliberately additive and
-- leaves the existing single-wallet machinery untouched: a customer's
-- original wallet (users.wallet_balance/_sandbox, wallet_ledger rows with
-- wallet_id IS NULL) stays exactly as it's always worked and is simply
-- presented as their "primary" wallet — renameable via
-- users.primary_wallet_name, but never migrated into this new table. Every
-- additional wallet a customer creates is a real row here with its own
-- balance, and every existing money-moving function in
-- ../wallet/service.ts (credit/debit/pay/refund/transfer) now takes an
-- optional walletId that, when given, operates on that row instead of the
-- users columns — so nothing about how the original wallet works changes
-- for any customer who never creates a second one.
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  balance_sandbox INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_id);

-- NULL on every existing row = the primary wallet, exactly the historical
-- meaning of "this ledger entry" before this migration — no backfill
-- needed for the column to mean the right thing on day one.
ALTER TABLE wallet_ledger ADD COLUMN wallet_id TEXT REFERENCES wallets(id);

-- Which of the owner's wallets a share grant applies to — NULL means the
-- primary wallet, matching every pre-existing share row.
ALTER TABLE wallet_shares ADD COLUMN wallet_id TEXT REFERENCES wallets(id);

-- Lets a customer rename their original/primary wallet without it ever
-- becoming a row in `wallets` — NULL displays as "Main Wallet".
ALTER TABLE users ADD COLUMN primary_wallet_name TEXT;
