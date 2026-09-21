-- Sandbox/live environment split — see apps/api/src/lib/settings.ts
-- (platform_environment) and apps/api/src/lib/monetization.ts-adjacent
-- write paths across orders/wallet/payments. "environment" tags which
-- dataset a row belongs to; accounts (users/riders) stay shared across
-- both — only orders, lists, wallet activity, and wallet balances are
-- actually split.
ALTER TABLE orders ADD COLUMN environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox'));
ALTER TABLE lists ADD COLUMN environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox'));
ALTER TABLE wallet_topups ADD COLUMN environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox'));
ALTER TABLE wallet_withdrawals ADD COLUMN environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox'));
ALTER TABLE wallet_ledger ADD COLUMN environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox'));

-- Existing `wallet_balance` on each table implicitly becomes the LIVE
-- balance (untouched name, so every already-shipped read/write path that
-- doesn't yet know about environments keeps working); this is the new
-- sandbox counterpart.
ALTER TABLE users ADD COLUMN wallet_balance_sandbox INTEGER NOT NULL DEFAULT 0;
ALTER TABLE riders ADD COLUMN wallet_balance_sandbox INTEGER NOT NULL DEFAULT 0;

-- One-time data migration: everything that exists right now predates this
-- feature and is real dev/test activity (see the admin conversation this
-- shipped from) — reclassify all of it as sandbox rather than deleting it,
-- so the live environment starts genuinely empty without losing anything.
-- Any money sitting in a wallet_balance from that test activity moves into
-- the new sandbox column so it isn't left looking like real, withdrawable
-- live earnings.
UPDATE orders SET environment = 'sandbox';
UPDATE lists SET environment = 'sandbox';
UPDATE wallet_topups SET environment = 'sandbox';
UPDATE wallet_withdrawals SET environment = 'sandbox';
UPDATE wallet_ledger SET environment = 'sandbox';
UPDATE users SET wallet_balance_sandbox = wallet_balance, wallet_balance = 0 WHERE wallet_balance != 0;
UPDATE riders SET wallet_balance_sandbox = wallet_balance, wallet_balance = 0 WHERE wallet_balance != 0;
