-- Scheduled opening hours, layered under the existing manual is_open flag.
-- open_time/close_time are "HH:MM" in the restaurant's local (Uganda, single
-- timezone) wall-clock time; both null means no schedule is set and is_open
-- stays a pure manual toggle, same as before this migration.
ALTER TABLE restaurants ADD COLUMN open_time TEXT;
ALTER TABLE restaurants ADD COLUMN close_time TEXT;
