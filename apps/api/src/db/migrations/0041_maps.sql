-- Map provider for location pickers and geocoding across the customer,
-- rider, and restaurant apps. Mirrors the calls module's shape on purpose
-- (../lib/settings.ts maps_active_provider, per-provider encrypted
-- credentials — same table shape as call_credentials/payment_credentials,
-- see 0040_calls.sql). 'streetmaps' (OpenStreetMap/Leaflet/Nominatim)
-- needs no credentials and is the safe default; 'google' and 'mapbox' are
-- selectable and fully wired to their real SDKs, but only actually take
-- over once an admin saves a working API key — see ../maps/credentials.ts
-- and apps/*/components/LocationMapPicker.tsx's fallback logic.
CREATE TABLE IF NOT EXISTS maps_credentials (
  provider TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, field)
);
