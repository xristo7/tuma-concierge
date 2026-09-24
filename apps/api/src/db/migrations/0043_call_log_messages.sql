-- WhatsApp-style call-log entries inside chat threads: when a call ends,
-- POST /calls/:id/end (see apps/api/src/calls/routes.ts) inserts a
-- synthetic message with type='call' carrying the outcome/duration, into
-- whichever chat table matches the call's pairing (order-based
-- customer<->rider chat, or restaurant<->customer chat). Both tables
-- CHECK-constrain `type`, which SQLite can't ALTER directly, so both get
-- recreated (small production row counts at time of writing — verified
-- via D1 query before running this).
--
-- chat_messages.order_id also moves from NOT NULL to nullable here: a
-- call can happen between a customer and rider with no specific order in
-- context (e.g. from the unified Chat tab), and the thread is already
-- addressed by (customer_id, rider_id) independent of order_id (see
-- 0019_chat_threads.sql) — so a call-log row shouldn't require one.

CREATE TABLE chat_messages_new (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'voice', 'call')),
  media_key TEXT,
  customer_id TEXT,
  rider_id TEXT,
  delivered_at TEXT,
  played_at TEXT,
  call_id TEXT REFERENCES calls(id),
  call_status TEXT,
  call_duration_seconds INTEGER
);

INSERT INTO chat_messages_new (
  id, order_id, sender_id, sender_role, body, created_at, type, media_key,
  customer_id, rider_id, delivered_at, played_at
)
SELECT
  id, order_id, sender_id, sender_role, body, created_at, type, media_key,
  customer_id, rider_id, delivered_at, played_at
FROM chat_messages;

DROP TABLE chat_messages;
ALTER TABLE chat_messages_new RENAME TO chat_messages;

CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(customer_id, rider_id);

CREATE TABLE restaurant_chat_messages_new (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  customer_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'restaurant')),
  body TEXT,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'voice', 'call')),
  media_key TEXT,
  menu_item_id TEXT REFERENCES menu_items(id),
  menu_item_name TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  call_id TEXT REFERENCES calls(id),
  call_status TEXT,
  call_duration_seconds INTEGER
);

INSERT INTO restaurant_chat_messages_new (
  id, restaurant_id, customer_id, sender_role, body, type, media_key,
  menu_item_id, menu_item_name, read, created_at
)
SELECT
  id, restaurant_id, customer_id, sender_role, body, type, media_key,
  menu_item_id, menu_item_name, read, created_at
FROM restaurant_chat_messages;

DROP TABLE restaurant_chat_messages;
ALTER TABLE restaurant_chat_messages_new RENAME TO restaurant_chat_messages;

CREATE INDEX IF NOT EXISTS idx_restaurant_chat_pair
  ON restaurant_chat_messages(restaurant_id, customer_id, created_at);
