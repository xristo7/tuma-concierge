-- Customer <-> restaurant messaging — separate from chat_messages (which is
-- hard-wired to customer/rider order pairs) since a restaurant owner isn't
-- a first-class role and this thread isn't tied to any one order: a
-- customer may message a restaurant before ordering, and the thread stays
-- continuous across orders, same as the customer<->rider chat model.
--
-- One continuous thread per (restaurant_id, customer_id) pair. A message
-- optionally references a menu item — the "ask about this item" entry
-- point — with the item's name snapshotted since the item (or its price)
-- can change or be deleted later.
CREATE TABLE IF NOT EXISTS restaurant_chat_messages (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  customer_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'restaurant')),
  body TEXT,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image')),
  media_key TEXT,
  menu_item_id TEXT REFERENCES menu_items(id),
  menu_item_name TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_restaurant_chat_pair
  ON restaurant_chat_messages(restaurant_id, customer_id, created_at);
