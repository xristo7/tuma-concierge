-- Lets a customer hide a list (and its order, if any) from their own
-- "Lists"/orders view once they've deleted it — see
-- POST /orders/:id/customer-delete in apps/api/src/orders/routes.ts. The
-- row itself is kept (never hard-deleted) for the same reason nothing
-- else in this schema is: order_events/payments/admin activity all still
-- need something to point at, and a customer backing out of an unpaid,
-- unmatched order is exactly the kind of thing support may need to look
-- back on. `orders.stage` has no CHECK constraint (see 0001_init.sql), so
-- the new terminal 'Cancelled' value needs no schema change at all.
ALTER TABLE lists ADD COLUMN customer_hidden INTEGER NOT NULL DEFAULT 0;
