-- Saved locations (Home/Office/etc) can now carry the map pin's exact
-- coordinates, not just the reverse-geocoded area/address text, so picking
-- one during order creation is as precise as pinning the map directly.

ALTER TABLE saved_locations ADD COLUMN lat REAL;
ALTER TABLE saved_locations ADD COLUMN lng REAL;
