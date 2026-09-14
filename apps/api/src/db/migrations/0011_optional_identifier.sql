-- Registration can now be completed with a phone number OR an email
-- address (previously phone was mandatory). SQLite has no ALTER COLUMN to
-- drop a NOT NULL constraint, so the table is rebuilt.
-- (Comments in these files must avoid the semicolon character entirely --
-- migrate.ts splits each file on it without understanding SQL comments.)

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS users_new;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'rider', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  phone_verified_at TEXT,
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, phone, email, name, password_hash, role, status, phone_verified_at, email_verified_at, created_at, updated_at)
SELECT id, phone, email, name, password_hash, role, status, phone_verified_at, email_verified_at, created_at, updated_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

PRAGMA foreign_keys=ON;
