-- Shared merchant identity and backed marketplace accounting.
-- Restaurants keep their existing operational tables; each restaurant is
-- linked to the same merchant/outlet model used by general retail sellers.

CREATE TABLE merchant_categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO merchant_categories (id, slug, name, sort_order) VALUES
  ('mcat_restaurant', 'restaurant', 'Restaurant', 10),
  ('mcat_supermarket', 'supermarket', 'Supermarket', 20),
  ('mcat_retail', 'retail-shop', 'Retail shop', 30),
  ('mcat_boutique', 'boutique', 'Boutique', 40),
  ('mcat_market', 'market-stall', 'Market stall', 50),
  ('mcat_other', 'other', 'Other', 100);

-- Informal/solo sellers are deliberately deferred to Merchant Lite. The
-- category remains in the taxonomy so later activation is a data change,
-- not a schema migration.
UPDATE merchant_categories SET active = 0 WHERE id IN ('mcat_market', 'mcat_other');

INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_payments_enabled', '0');
-- Sandbox is independently enabled so the complete merchant journey can be
-- tested without making the live feature eligible for activation.
INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_sandbox_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_instant_fee_flat', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_live_custody_approved', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_withdrawals_frozen', '0');

CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  business_kind TEXT NOT NULL DEFAULT 'business' CHECK (business_kind IN ('business', 'personal_seller')),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'provisional', 'active', 'suspended', 'rejected')),
  trust_tier TEXT NOT NULL DEFAULT 'new' CHECK (trust_tier IN ('new', 'standard', 'trusted', 'restricted')),
  registration_number TEXT,
  tax_id TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE merchant_outlets (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  category_id TEXT NOT NULL REFERENCES merchant_categories(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_merchant_outlets_merchant ON merchant_outlets(merchant_id);
CREATE INDEX idx_merchant_outlets_category ON merchant_outlets(category_id, status);

CREATE TABLE merchant_members (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'finance', 'manager', 'cashier')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'revoked')),
  outlet_id TEXT REFERENCES merchant_outlets(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (merchant_id, user_id)
);

CREATE INDEX idx_merchant_members_user ON merchant_members(user_id, status);

CREATE TABLE merchant_kyc_cases (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
  phone_verified INTEGER NOT NULL DEFAULT 0,
  identity_verified INTEGER NOT NULL DEFAULT 0,
  business_verified INTEGER NOT NULL DEFAULT 0,
  owner_id_key TEXT,
  business_document_key TEXT,
  risk_notes TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE merchant_settlement_accounts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  type TEXT NOT NULL CHECK (type IN ('momo', 'bank')),
  provider TEXT NOT NULL,
  account_ref TEXT NOT NULL,
  account_ref_last4 TEXT NOT NULL,
  account_name TEXT,
  network_or_bank TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'disabled')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  cooling_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_merchant_settlement_accounts_merchant ON merchant_settlement_accounts(merchant_id, status);

CREATE TABLE ledger_accounts (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('platform', 'customer', 'order', 'merchant', 'rider', 'provider')),
  owner_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UGX',
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_type, owner_id, purpose, currency, environment)
);

-- Operational cache for atomic availability checks. The immutable ledger
-- remains the accounting source of truth; reconciliation verifies that
-- these three columns equal their corresponding account totals.
CREATE TABLE merchant_balances (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  pending INTEGER NOT NULL DEFAULT 0 CHECK (pending >= 0),
  held INTEGER NOT NULL DEFAULT 0 CHECK (held >= 0),
  available INTEGER NOT NULL DEFAULT 0 CHECK (available >= 0),
  settling INTEGER NOT NULL DEFAULT 0 CHECK (settling >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (merchant_id, environment)
);

CREATE TABLE ledger_transactions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  description TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  reversal_of TEXT REFERENCES ledger_transactions(id),
  actor_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(environment, idempotency_key)
);

CREATE INDEX idx_ledger_transactions_reference ON ledger_transactions(reference_type, reference_id);

CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES ledger_transactions(id),
  account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id, created_at);
CREATE INDEX idx_ledger_entries_transaction ON ledger_entries(transaction_id);

CREATE TABLE merchant_policies (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'tier', 'merchant')),
  scope_id TEXT NOT NULL,
  settlement_release_mode TEXT NOT NULL DEFAULT 'risk_based_immediate' CHECK (settlement_release_mode IN ('risk_based_immediate', 'manual_hold')),
  unconfirmed_release_hours INTEGER,
  payment_confirmation_mode TEXT NOT NULL DEFAULT 'dual_confirm' CHECK (payment_confirmation_mode IN ('dual_confirm', 'merchant_request', 'rider_only')),
  kyc_gate TEXT NOT NULL DEFAULT 'approved_before_receiving' CHECK (kyc_gate IN ('approved_before_receiving', 'provisional_limits', 'before_withdrawal')),
  order_budget_mode TEXT NOT NULL DEFAULT 'prefunded_cap' CHECK (order_budget_mode IN ('prefunded_cap', 'approve_each_purchase', 'rider_exception')),
  unused_funds_mode TEXT NOT NULL DEFAULT 'wallet' CHECK (unused_funds_mode IN ('wallet', 'original_source', 'customer_choice')),
  rider_unlock_mode TEXT NOT NULL DEFAULT 'verified_handover' CHECK (rider_unlock_mode IN ('verified_handover', 'rider_marked', 'dispute_window')),
  instant_fee_mode TEXT NOT NULL DEFAULT 'merchant' CHECK (instant_fee_mode IN ('merchant', 'platform')),
  scheduled_fee_mode TEXT NOT NULL DEFAULT 'platform' CHECK (scheduled_fee_mode IN ('merchant', 'platform', 'disabled')),
  scheduled_cadence TEXT NOT NULL DEFAULT 'next_business_day' CHECK (scheduled_cadence IN ('next_business_day', 'weekly', 'manual')),
  merchant_commission_type TEXT NOT NULL DEFAULT 'none' CHECK (merchant_commission_type IN ('none', 'percent', 'subscription')),
  merchant_commission_value REAL NOT NULL DEFAULT 0,
  rollout_mode TEXT NOT NULL DEFAULT 'cohort' CHECK (rollout_mode IN ('cohort', 'category', 'open')),
  max_outlets INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scope_type, scope_id)
);

INSERT INTO merchant_policies (id, scope_type, scope_id)
VALUES ('mpol_global', 'global', 'global');

ALTER TABLE orders ADD COLUMN funds_model TEXT NOT NULL DEFAULT 'legacy_rider_payout'
  CHECK (funds_model IN ('legacy_rider_payout', 'merchant_allocations_v1'));

CREATE TABLE order_budgets (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  principal_funded INTEGER NOT NULL DEFAULT 0,
  principal_allocated INTEGER NOT NULL DEFAULT 0,
  principal_refunded INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unfunded' CHECK (status IN ('unfunded', 'funded', 'partially_allocated', 'fully_allocated', 'closed', 'refunded')),
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (principal_funded >= 0),
  CHECK (principal_allocated >= 0),
  CHECK (principal_refunded >= 0),
  CHECK (principal_allocated + principal_refunded <= principal_funded)
);

CREATE TABLE merchant_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  outlet_id TEXT NOT NULL REFERENCES merchant_outlets(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation' CHECK (status IN ('awaiting_confirmation', 'available', 'held', 'settlement_pending', 'paid', 'declined', 'expired', 'reversed', 'disputed', 'failed')),
  confirmation_mode TEXT NOT NULL CHECK (confirmation_mode IN ('dual_confirm', 'merchant_request', 'rider_only')),
  rider_id TEXT NOT NULL REFERENCES users(id),
  initiated_by TEXT NOT NULL REFERENCES users(id),
  rider_confirmed_at TEXT,
  merchant_confirmed_at TEXT,
  available_at TEXT,
  risk_state TEXT NOT NULL DEFAULT 'pending' CHECK (risk_state IN ('pending', 'passed', 'step_up', 'held', 'rejected')),
  rider_lat REAL,
  rider_lng REAL,
  rider_accuracy_m REAL,
  location_captured_at TEXT,
  outlet_distance_m REAL,
  evidence_mode TEXT CHECK (evidence_mode IN ('gps', 'dynamic_request', 'merchant_reauth_receipt')),
  receipt_reference TEXT,
  risk_reason TEXT,
  policy_version INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(environment, idempotency_key)
);

CREATE INDEX idx_merchant_payments_order ON merchant_payments(order_id, status);
CREATE INDEX idx_merchant_payments_merchant ON merchant_payments(merchant_id, status);

CREATE TABLE merchant_settlements (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  settlement_account_id TEXT NOT NULL REFERENCES merchant_settlement_accounts(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  fee INTEGER NOT NULL DEFAULT 0,
  total_debit INTEGER NOT NULL CHECK (total_debit > 0),
  mode TEXT NOT NULL CHECK (mode IN ('instant', 'scheduled')),
  provider TEXT,
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'submitted', 'pending', 'unknown', 'successful', 'failed', 'reversed', 'cancelled')),
  idempotency_key TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  failure_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(environment, idempotency_key)
);

CREATE TABLE merchant_settlement_quotes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  settlement_account_id TEXT NOT NULL REFERENCES merchant_settlement_accounts(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  fee INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0),
  total_debit INTEGER NOT NULL CHECK (total_debit > 0),
  mode TEXT NOT NULL CHECK (mode IN ('instant', 'scheduled')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_merchant_settlements_merchant ON merchant_settlements(merchant_id, created_at);

CREATE TABLE provider_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('collection', 'disbursement', 'refund')),
  business_type TEXT NOT NULL,
  business_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  idempotency_key TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'UGX',
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending', 'unknown', 'successful', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_check_at TEXT NOT NULL DEFAULT (datetime('now', '+2 minutes')),
  last_checked_at TEXT,
  lease_token TEXT,
  lease_until TEXT,
  terminal_at TEXT,
  failure_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(environment, idempotency_key),
  UNIQUE(environment, provider, provider_ref)
);

CREATE INDEX idx_provider_operations_due
  ON provider_operations(status, next_check_at);

CREATE TABLE merchant_risk_decisions (
  id TEXT PRIMARY KEY,
  merchant_payment_id TEXT NOT NULL REFERENCES merchant_payments(id),
  decision TEXT NOT NULL CHECK (decision IN ('pass', 'step_up', 'hold', 'reject', 'release')),
  distance_m REAL,
  gps_accuracy_m REAL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT,
  decided_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_merchant_risk_payment ON merchant_risk_decisions(merchant_payment_id, created_at);

CREATE TABLE merchant_custody_approvals (
  id TEXT PRIMARY KEY,
  custody_provider TEXT NOT NULL,
  payout_provider TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UGX',
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  safeguarding_reference TEXT NOT NULL,
  approved_by TEXT NOT NULL REFERENCES users(id),
  effective_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rider_order_locks (
  rider_id TEXT PRIMARY KEY REFERENCES users(id),
  order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  acquired_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE merchant_disputes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  merchant_payment_id TEXT REFERENCES merchant_payments(id),
  opened_by TEXT NOT NULL REFERENCES users(id),
  amount INTEGER,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved_merchant', 'resolved_customer', 'cancelled')),
  resolved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE restaurants ADD COLUMN merchant_id TEXT REFERENCES merchants(id);
ALTER TABLE restaurants ADD COLUMN outlet_id TEXT REFERENCES merchant_outlets(id);

INSERT OR IGNORE INTO merchants (
  id, legal_name, display_name, status, trust_tier, environment, approved_at
)
SELECT 'mer_' || id, name, name,
       CASE status WHEN 'active' THEN 'active' WHEN 'suspended' THEN 'suspended' ELSE 'pending_approval' END,
       'standard', environment,
       CASE WHEN status = 'active' THEN datetime('now') ELSE NULL END
FROM restaurants;

INSERT OR IGNORE INTO merchant_outlets (
  id, merchant_id, category_id, name, code, phone, address, lat, lng, status
)
SELECT 'out_' || id, 'mer_' || id, 'mcat_restaurant', name, 'REST-' || upper(substr(id, -8)),
       phone, address, lat, lng,
       CASE WHEN status = 'suspended' THEN 'suspended' ELSE 'active' END
FROM restaurants;

INSERT OR IGNORE INTO merchant_members (merchant_id, user_id, role, status)
SELECT 'mer_' || id, owner_id, 'owner', 'active' FROM restaurants;

INSERT OR IGNORE INTO merchant_balances (merchant_id, environment)
SELECT id, environment FROM merchants;

UPDATE restaurants
SET merchant_id = 'mer_' || id,
    outlet_id = 'out_' || id
WHERE merchant_id IS NULL;
