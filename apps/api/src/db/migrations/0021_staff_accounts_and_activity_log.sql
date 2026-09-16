-- Staff accounts (role-based access for the admin app, beyond a single
-- undifferentiated "admin"), plus an activity log staff actions write to.
--
-- admin_role: which kind of staff member this is. Only meaningful when
-- role='admin' -- a customer/rider row always has it NULL. Checked against
-- a fixed list so a typo in application code can't silently create a role
-- nobody's permission table recognizes.
ALTER TABLE users ADD COLUMN admin_role TEXT
  CHECK (admin_role IS NULL OR admin_role IN (
    'super_admin', 'finance_manager', 'customer_manager', 'rider_manager',
    'support_manager', 'operations_manager', 'compliance_manager'
  ));

-- Every existing admin account (there's no self-signup for admins, so these
-- were all provisioned by hand) becomes a Super Admin under the new system
-- -- otherwise this migration would strip access from whoever's running it.
UPDATE users SET admin_role = 'super_admin' WHERE role = 'admin' AND admin_role IS NULL;

-- Set on a freshly-invited staff account; cleared the moment they change
-- their password (see auth/routes.ts). requireAuth rejects almost every
-- request while this is 1, so a temporary password is exactly that.
ALTER TABLE users ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT 0;

-- Who invited this staff member and when -- shown on the Staff page, and
-- useful context if their access is ever questioned later.
ALTER TABLE users ADD COLUMN invited_by TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN invited_at TEXT;

-- Updated on every successful login -- lets the Staff page show who has
-- never actually signed in yet versus who's gone quiet.
ALTER TABLE users ADD COLUMN last_login_at TEXT;

-- A customer's own photo, shown to the rider assigned to their order (the
-- same trust signal the rider's photo already gives customers). Also usable
-- by staff accounts for their own avatar. Riders keep their existing,
-- separate riders.profile_photo_key -- it's already wired into profile
-- completeness and chat display, so this doesn't touch that.
ALTER TABLE users ADD COLUMN profile_photo_key TEXT;

-- One row per staff action worth being able to answer "who did this, and
-- when" about. actor_name/actor_role are denormalized (copied at write
-- time) so the log stays readable even if the actor's own name or role
-- changes later -- a log that rewrites its own history when you look at it
-- sideways isn't much of a log.
--
-- before_json/after_json capture enough of the affected row to undo the
-- action later (see revert_admin_action in the API) -- only populated for
-- actions that are actually revertible, which is what `revertible` says.
-- reverted_at/reverted_by record that a revert happened rather than
-- deleting the original entry, so the log stays a complete history instead
-- of one that edits itself.
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  revertible INTEGER NOT NULL DEFAULT 0,
  reverted_at TEXT,
  reverted_by TEXT REFERENCES users(id),
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_actor ON admin_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_entity ON admin_activity_log(entity_type, entity_id);
