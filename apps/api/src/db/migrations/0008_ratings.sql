CREATE TABLE IF NOT EXISTS order_ratings (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  rider_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_ratings_rider ON order_ratings(rider_id);
