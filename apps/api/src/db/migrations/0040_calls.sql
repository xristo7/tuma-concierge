-- Voice calls between customers, riders, and restaurants. Mirrors the
-- payments module's shape on purpose: an admin-selectable active provider
-- (../lib/settings.ts calls_active_provider), per-provider encrypted
-- credentials (call_credentials, same table shape as payment_credentials —
-- see ../payments/credentials.ts / 0028_payment_credentials.sql), and this
-- log of call attempts. 'mock' needs no credentials and is the safe
-- default; 'cloudflare' is the first provider with a real, working
-- adapter (../calls/cloudflare.ts) — 'twilio'/'agora' are selectable but
-- stubbed until real credentials and SDK wiring are added for them.
CREATE TABLE IF NOT EXISTS call_credentials (
  provider TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, field)
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL REFERENCES users(id),
  callee_id TEXT NOT NULL REFERENCES users(id),
  -- Optional context this call happened in (an order, a restaurant chat) —
  -- purely informational, never required to place or answer a call.
  order_id TEXT REFERENCES orders(id),
  restaurant_id TEXT REFERENCES restaurants(id),
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (
    status IN ('ringing', 'accepted', 'declined', 'missed', 'ended', 'failed')
  ),
  -- Cloudflare Realtime SFU session ids, one per participant (see
  -- ../calls/cloudflare.ts) — null for the mock/unimplemented providers.
  caller_session_id TEXT,
  callee_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at TEXT,
  ended_at TEXT,
  duration_seconds INTEGER,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox'))
);

CREATE INDEX IF NOT EXISTS idx_calls_callee_status ON calls(callee_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id, created_at);
