-- Rider subscription billing — see apps/api/src/riders/subscription.ts.
-- subscription_status/subscription_paid_through are the same shape for
-- both billing modes (recurring or one-time-lifetime, admin's choice —
-- see settings.monetization_subscription_mode): "active" means usable
-- through subscription_paid_through, which for a lifetime payment is set
-- far in the future rather than needing a separate always-active flag —
-- one check ("is paid_through still ahead of now") covers both modes.
ALTER TABLE riders ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'inactive'
  CHECK (subscription_status IN ('inactive', 'active', 'past_due'));
ALTER TABLE riders ADD COLUMN subscription_paid_through TEXT;

-- One row per subscription charge attempt — the audit trail a rider
-- dispute or an admin review can always reconstruct status from, mirroring
-- wallet_topups/wallet_withdrawals' own pending/successful/failed shape.
CREATE TABLE IF NOT EXISTS rider_subscription_payments (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL CHECK (mode IN ('recurring', 'once')),
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  msisdn TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
  -- The coverage period this charge pays for once successful — NULL/NULL
  -- for a "once" lifetime charge (nothing to renew), period_end onward for
  -- a recurring one.
  period_start TEXT,
  period_end TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rider_subscription_payments_rider ON rider_subscription_payments(rider_id);
