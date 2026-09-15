-- Security hardening.
-- (Comments in these files must avoid the semicolon character entirely --
-- migrate.ts splits each file on it without understanding SQL comments.)
--
-- sessions_valid_from: every token carries an "issued at" claim, and any
-- token issued before this timestamp is rejected. Set it on password reset
-- and on suspension so those actions actually end existing sessions instead
-- of only stopping future logins.
--
-- revoked_sessions: a single signed-out token, by its unique jti claim.
-- Rows can be dropped once expires_at passes -- the token is dead anyway.
--
-- rate_limits: counters for login attempts, registrations and AI usage.
-- Keyed by a caller-built string such as "login:<hash>" or "voice:<userId>".

ALTER TABLE users ADD COLUMN sessions_valid_from TEXT;

CREATE TABLE IF NOT EXISTS revoked_sessions (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON revoked_sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_locked_until ON rate_limits(locked_until);
