-- Adds account status (active/suspended) so admins can manage problem
-- accounts on either side of the marketplace, plus an index to make the
-- admin dashboard's role-filtered listings (customers, riders) cheap.

ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
