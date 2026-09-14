-- Onboarding verification: either phone (SMS) or email confirms a new
-- account. Existing accounts at migration time are grandfathered in as
-- already-verified so this only gates registrations going forward.
-- (Comments in these files must avoid the semicolon character entirely --
-- migrate.ts splits each file on it without understanding SQL comments.)

ALTER TABLE users ADD COLUMN phone_verified_at TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

UPDATE users SET phone_verified_at = datetime('now') WHERE phone_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_channel ON otp_codes(user_id, channel, created_at);
