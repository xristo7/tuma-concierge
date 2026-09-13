-- Adds parcel-delivery orders (alongside shopping-list orders) and saved
-- customer locations (Home/Office/etc). Idempotent-ish: guarded with a
-- pragma check for the ALTER statements since SQLite has no
-- "ADD COLUMN IF NOT EXISTS".

ALTER TABLE orders ADD COLUMN type TEXT NOT NULL DEFAULT 'shopping' CHECK (type IN ('shopping', 'parcel'));
ALTER TABLE orders ADD COLUMN pickup_area TEXT;
ALTER TABLE orders ADD COLUMN pickup_address TEXT;

CREATE TABLE IF NOT EXISTS saved_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  area TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON saved_locations(user_id);
