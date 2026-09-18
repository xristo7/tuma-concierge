-- Distinguishes an account that knows its own password from a Google-only
-- signup, whose password_hash is a random value nobody was ever shown (see
-- authRoutes.post("/google") in auth/routes.ts). Without this the
-- password-change form has no way to tell a Google-only user apart from
-- everyone else, and would just fail every attempt with "that's not your
-- current password" -- confusing rather than useful.
--
-- NULL: no known password (either never set one, or a Google-only account).
-- Set on: native registration (they chose it), a completed "forgot
-- password" reset (recovery path for a Google-only user to gain one), and
-- an explicit password change.
--
-- Backfill treats every existing row as already having a known password --
-- true for the overwhelming majority (anyone who registered with a phone
-- or email chose their own password) and only wrong for an existing
-- Google-only account that has never reset its password, which lands back
-- on the same "wrong password" message it would have gotten before this
-- column existed -- a worse UX for a narrow slice of accounts, not a
-- correctness or security issue, and self-corrects the moment they use
-- "forgot password" once.

ALTER TABLE users ADD COLUMN password_set_at TEXT;

UPDATE users SET password_set_at = created_at WHERE password_set_at IS NULL;
