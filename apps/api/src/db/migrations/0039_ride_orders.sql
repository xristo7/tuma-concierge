-- Passenger rides ("call a rider to pick you up and take you somewhere,
-- like SafeBoda") reuse the parcel order shape exactly — pickup point,
-- destination point, distance-priced fare, same stage machine plus one
-- extra stage (see orders/routes.ts's /picked-up) — so this stays
-- type='parcel' at the DB level rather than widening orders.type's CHECK
-- constraint, which would mean rebuilding the whole (live, populated)
-- orders table just to add one more string value. This flag is the only
-- thing that distinguishes a ride from a goods parcel.
ALTER TABLE orders ADD COLUMN is_ride INTEGER NOT NULL DEFAULT 0;
