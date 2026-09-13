-- Full rider profile, required before a rider can be approved to take jobs.
-- National ID scan is stored in R2 (RIDER_DOCS binding); this column just
-- holds the object key — verification-only, never exposed via any public route.

ALTER TABLE riders ADD COLUMN first_name TEXT;
ALTER TABLE riders ADD COLUMN last_name TEXT;
ALTER TABLE riders ADD COLUMN alt_phone TEXT;
ALTER TABLE riders ADD COLUMN stage_address TEXT;
ALTER TABLE riders ADD COLUMN home_address TEXT;
ALTER TABLE riders ADD COLUMN stage_lat REAL;
ALTER TABLE riders ADD COLUMN stage_lng REAL;
ALTER TABLE riders ADD COLUMN stage_name TEXT;
ALTER TABLE riders ADD COLUMN stage_chairman_name TEXT;
ALTER TABLE riders ADD COLUMN stage_chairman_contact TEXT;
ALTER TABLE riders ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE riders ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE riders ADD COLUMN national_id_key TEXT;
ALTER TABLE riders ADD COLUMN profile_completed_at TEXT;
