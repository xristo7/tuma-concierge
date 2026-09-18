-- Wallet sharing between customers, two forms:
--  (a) a one-off transfer of funds directly into another customer's
--      wallet — still closed-loop (money never leaves to mobile money,
--      it just moves between two customers), recorded as a paired
--      transfer_out/transfer_in ledger entry;
--  (b) ongoing "spend from my wallet" access one customer grants
--      another (a household/family-style shared wallet) — the balance
--      stays the owner's the whole time, an active grant just lets the
--      grantee pay for THEIR OWN orders out of it. wallet_ledger.actor_id
--      already exists for exactly this — "whose balance" (user_id) vs.
--      "who actually triggered it" (actor_id) — it just wasn't populated
--      by payFromWallet before now.
--
-- SQLite can't ALTER a CHECK constraint in place, so wallet_ledger.type
-- is widened by rebuilding the table (same pattern as
-- 0011_optional_identifier.sql), which also adds counterparty_id for
-- the "other party" on a transfer entry.

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS wallet_ledger_new;

CREATE TABLE wallet_ledger_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('topup', 'order_payment', 'refund', 'adjustment', 'transfer_out', 'transfer_in')),
  amount INTEGER NOT NULL, -- positive = credit, negative = debit
  balance_after INTEGER NOT NULL,
  order_id TEXT REFERENCES orders(id),
  topup_id TEXT REFERENCES wallet_topups(id),
  counterparty_id TEXT REFERENCES users(id), -- the other party on a transfer_out/transfer_in entry
  note TEXT,
  actor_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO wallet_ledger_new (id, user_id, type, amount, balance_after, order_id, topup_id, note, actor_id, created_at)
SELECT id, user_id, type, amount, balance_after, order_id, topup_id, note, actor_id, created_at FROM wallet_ledger;

DROP TABLE wallet_ledger;

ALTER TABLE wallet_ledger_new RENAME TO wallet_ledger;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);

PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS wallet_shares (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  grantee_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT,
  CHECK (owner_id != grantee_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_shares_owner ON wallet_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_wallet_shares_grantee ON wallet_shares(grantee_id);

-- Only one live (pending or active) invite between a given pair at a time
-- — re-inviting after a decline/revoke is fine, it just starts a fresh row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_shares_live_pair
  ON wallet_shares(owner_id, grantee_id)
  WHERE status IN ('pending', 'active');
