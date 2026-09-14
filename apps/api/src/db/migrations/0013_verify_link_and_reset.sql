-- Lets an otp_codes row serve two purposes: onboarding "verify" (existing)
-- and password-reset "reset" (new) - kept in the same table since both are
-- short-lived, rate-limited, one-time codes. Email "verify" rows also carry
-- a long opaque link_token_hash so clicking the button in the email
-- confirms in one tap, instead of only supporting a typed 6-digit code.
-- (Comments in these files must avoid the semicolon character entirely --
-- migrate.ts splits each file on it without understanding SQL comments.)

ALTER TABLE otp_codes ADD COLUMN purpose TEXT NOT NULL DEFAULT 'verify' CHECK (purpose IN ('verify', 'reset'));
ALTER TABLE otp_codes ADD COLUMN link_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_otp_codes_link_token ON otp_codes(link_token_hash);
