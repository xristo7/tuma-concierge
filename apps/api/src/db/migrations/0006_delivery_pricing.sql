-- Distance-based delivery pricing + nearest-rider matching support.
-- Orders gain optional lat/lng for pickup and destination (only ever set
-- when the customer used the map picker) plus the computed ride distance,
-- and a flag for when a match had to reach outside the normal service
-- range. A generic key/value settings table holds admin-tunable numbers
-- (delivery_rate_per_km, service_range_km) so they don't need a redeploy
-- to change.
-- (Comments in these files must avoid the semicolon character entirely --
-- migrate.ts splits each file on it without understanding SQL comments.)

ALTER TABLE orders ADD COLUMN pickup_lat REAL;
ALTER TABLE orders ADD COLUMN pickup_lng REAL;
ALTER TABLE orders ADD COLUMN destination_lat REAL;
ALTER TABLE orders ADD COLUMN destination_lng REAL;
ALTER TABLE orders ADD COLUMN distance_km REAL;
ALTER TABLE orders ADD COLUMN matched_out_of_range INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('delivery_rate_per_km', '1000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('service_range_km', '7');
