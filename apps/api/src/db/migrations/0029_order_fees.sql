-- Monetization fee breakdown for one order, locked in at Fund time (see
-- apps/api/src/lib/monetization.ts and orders/routes.ts's fund handler) so
-- Settle withholds the rider's cut using the rates that actually applied
-- when the customer paid, not whatever the admin-configured rates happen
-- to be by the time the order settles. One row per order, written only
-- when at least one monetization mechanism was enabled and the order
-- actually went through a real collection (not float rail).
CREATE TABLE IF NOT EXISTS order_fees (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  service_fee INTEGER NOT NULL DEFAULT 0,
  processing_fee_customer INTEGER NOT NULL DEFAULT 0,
  processing_fee_rider INTEGER NOT NULL DEFAULT 0,
  delivery_commission INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
