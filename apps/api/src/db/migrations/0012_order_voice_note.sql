-- A customer can attach a short voice recording to an order — spoken
-- context a typed list can miss (units, brand, "the small tin not the
-- family pack", a landmark inside the shop). Stored in R2 like the rider's
-- National ID scan; this column just holds the object key. Playable by
-- whoever can already see the order (customer, assigned rider, admin).

ALTER TABLE orders ADD COLUMN voice_note_key TEXT;
