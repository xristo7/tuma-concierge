-- Web Push subscriptions (one browser/device registration per row) and
-- per-conversation read tracking, powering: (1) a popup + tone notification
-- when a new chat message arrives, even with the app closed, and (2) the
-- unread badge on the Chat tab and in the thread list.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS chat_reads (
  user_id TEXT NOT NULL REFERENCES users(id),
  counterpart_id TEXT NOT NULL REFERENCES users(id),
  last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, counterpart_id)
);
