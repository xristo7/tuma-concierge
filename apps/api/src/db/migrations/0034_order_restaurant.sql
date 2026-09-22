-- Phase 3 of restaurant/food ordering: the customer-facing checkout link.
--
-- Deliberately NOT a new orders.type value ("food") — orders is by far the
-- most-referenced table in the schema (payments, order_events,
-- order_applications, fee_proposals, order_rider_exclusions,
-- order_ratings, order_fees, chat_messages, wallet_ledger all point at
-- it), so a live rebuild to widen that CHECK constraint is much riskier
-- than the same problem on `users` (see migrations/0032_restaurants.sql's
-- own note) and isn't attempted here. A food order is simply
-- type='shopping' with restaurant_id set — it rides the exact same
-- escrow/Fund/Settle machinery every shopping order already uses; this
-- column is just what marks "this one's items came from a menu, not a
-- freeform list" and gives it a real pickup point (the restaurant's own
-- lat/lng) instead of the flat-fee-because-pickup-is-unknown case a
-- freeform shopping order is in.
ALTER TABLE orders ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
