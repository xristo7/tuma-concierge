-- A rider can back out of a job they've been matched to. The order drops
-- back into the matching pool (unassigned) for another rider to pick up
-- instead of being cancelled outright, and the rider who backed out is
-- never offered that same order again.
-- (Comments in these files must avoid the semicolon character entirely --
-- migrate.ts splits each file on it without understanding SQL comments.)

CREATE TABLE IF NOT EXISTS order_rider_exclusions (
  order_id TEXT NOT NULL REFERENCES orders(id),
  rider_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (order_id, rider_id)
);
