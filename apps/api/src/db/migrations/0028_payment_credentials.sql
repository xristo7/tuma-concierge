-- Admin-editable API credentials for payment aggregators (Yo! Payments,
-- Flutterwave). Values are AES-256-GCM encrypted before they ever reach
-- this table — see ../../lib/crypto.ts and ../../payments/credentials.ts.
-- Kept separate from the generic `settings` key/value table since these
-- rows hold secrets, not plain config.
CREATE TABLE IF NOT EXISTS payment_credentials (
  provider TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, field)
);
