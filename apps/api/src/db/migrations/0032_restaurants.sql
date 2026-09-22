-- Phase 1 of restaurant/food ordering: the restaurants table plus the
-- admin-facing directory (approve/suspend). Menu items, food orders, and
-- the acceptance/prep-time flow are later phases.
--
-- Deliberately NOT a first-class users.role value yet — widening that
-- CHECK constraint means rebuilding the live users table (SQLite can't
-- alter a CHECK in place), which isn't available to run right now. A
-- restaurant owner is instead a normal 'customer'-role account that also
-- owns a row here; ../auth/restaurant.ts checks that ownership directly
-- rather than a role claim. Revisit once the users-table rebuild can run —
-- see project memory / this migration's sibling commit for the deferred
-- three-statement swap.
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  cuisine TEXT,
  phone TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  logo_key TEXT,
  cover_key TEXT,
  -- pending_approval: signed up, admin hasn't reviewed yet — invisible to
  -- customers. active: approved, visible (subject to is_open below).
  -- suspended: admin pulled it from the platform.
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended')),
  -- Manual override a restaurant flips themselves (closed for the night,
  -- out of ingredients, etc.) — separate from admin's status above, which
  -- only admin controls.
  is_open INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status, environment);
