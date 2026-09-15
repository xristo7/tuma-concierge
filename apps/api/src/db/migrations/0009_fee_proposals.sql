-- Lets a rider suggest a different delivery total than the app's own
-- auto-calculated (or customer-entered) figure -- e.g. after an out-of-range
-- match, or heavier traffic than the distance estimate assumed. The customer
-- must accept or reject it; nothing changes until they do. Both the
-- previous and proposed totals are kept on the row itself as a record.

CREATE TABLE IF NOT EXISTS fee_proposals (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  previous_total INTEGER NOT NULL,
  proposed_total INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fee_proposals_order ON fee_proposals(order_id);
