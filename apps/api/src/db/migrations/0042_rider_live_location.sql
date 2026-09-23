-- Live rider position for customer-facing map tracking — see
-- apps/api/src/orders/routes.ts POST /orders/:id/location. Only populated
-- while the rider has in-app navigation open with nav_mode = "in_app"
-- (see apps/rider/lib/settings nav_mode); customers never see a stale pin
-- because the UI treats anything older than a couple minutes as offline.

ALTER TABLE orders ADD COLUMN rider_lat REAL;
ALTER TABLE orders ADD COLUMN rider_lng REAL;
ALTER TABLE orders ADD COLUMN rider_location_updated_at TEXT;
