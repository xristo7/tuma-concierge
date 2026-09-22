-- Saved mobile money numbers, up to 2 per (owner, purpose) — 'payment' for a
-- customer paying an order/topping up their wallet, 'withdrawal' for a
-- rider (and, once it exists, a restaurant) cashing out. Generic on
-- owner_id (any users row) rather than a role-specific table, since a
-- restaurant owner is itself a customer-role account (see
-- 0032_restaurants.sql) and would otherwise collide with its own personal
-- payment numbers if this were keyed any other way.
CREATE TABLE IF NOT EXISTS saved_mobile_numbers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('payment', 'withdrawal')),
  phone TEXT NOT NULL,
  label TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (owner_id, purpose, phone)
);

CREATE INDEX IF NOT EXISTS idx_saved_mobile_numbers_owner ON saved_mobile_numbers(owner_id, purpose);
