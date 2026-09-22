-- Restaurant chat composer now matches the order chat's (text/photo/voice),
-- so the message type needs 'voice' too. The table is brand new and empty
-- in production, so recreate it rather than fight SQLite's lack of
-- ALTER-the-CHECK-constraint support.
DROP TABLE IF EXISTS restaurant_chat_messages;

CREATE TABLE restaurant_chat_messages (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  customer_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'restaurant')),
  body TEXT,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'voice')),
  media_key TEXT,
  menu_item_id TEXT REFERENCES menu_items(id),
  menu_item_name TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_restaurant_chat_pair
  ON restaurant_chat_messages(restaurant_id, customer_id, created_at);
