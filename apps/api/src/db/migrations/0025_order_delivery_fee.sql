-- Splits an order's total into an items portion and a delivery-fee
-- portion, stored explicitly rather than re-derived, since substitutions
-- and fee proposals mutate final_total afterward (the delivery portion
-- itself never changes once set — only the items side does).
--
-- Parcel orders already had no items at all: their whole estimated/final
-- total IS the delivery fee, so this column just makes that explicit.
-- Shopping orders previously charged only the items cost with no delivery
-- fee at all; existing shopping orders are backfilled to 0 here since
-- there's nothing to retroactively charge — only new orders get a real fee
-- (see getDeliverySettings' shoppingDeliveryFee, apps/api/src/orders/routes.ts).
ALTER TABLE orders ADD COLUMN delivery_fee INTEGER;

UPDATE orders SET delivery_fee = COALESCE(final_total, estimated_total, 0) WHERE type = 'parcel';
UPDATE orders SET delivery_fee = 0 WHERE type = 'shopping';
