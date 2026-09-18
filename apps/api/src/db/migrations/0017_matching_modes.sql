ALTER TABLE users ADD COLUMN default_matching_mode TEXT;

ALTER TABLE orders ADD COLUMN matching_mode TEXT NOT NULL DEFAULT 'first_to_claim';
ALTER TABLE orders ADD COLUMN matching_deadline_at TEXT;

ALTER TABLE order_ratings ADD COLUMN recommended INTEGER NOT NULL DEFAULT 0;

-- Riders "apply" for a job under the nearest_window / customer_selects
-- matching modes instead of claiming it outright (see orders/matching.ts) —
-- the order collects applicants and either the app or the customer picks one.
CREATE TABLE IF NOT EXISTS order_applications (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  rider_id TEXT NOT NULL REFERENCES users(id),
  distance_km REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(order_id, rider_id)
);

CREATE INDEX IF NOT EXISTS idx_order_applications_order ON order_applications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_applications_rider ON order_applications(rider_id);
