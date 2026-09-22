-- Phase 2 of restaurant/food ordering: menu management. Categories group
-- items for display; items carry the base price; options/choices are the
-- "Size: Regular/Large", "Add cheese +1500"-style customization every
-- real food app needs — priced as a delta off the item's base price.
-- Ordering itself (customer browsing, cart, checkout) is a later phase;
-- this is just the owner-facing CRUD surface.
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON menu_categories(restaurant_id);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  -- Nullable: an item can sit outside any category ("uncategorized"),
  -- shown in its own bucket rather than forcing one to exist first.
  category_id TEXT REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  photo_key TEXT,
  -- The owner's own 86-a-dish toggle — distinct from the restaurant-level
  -- is_open (restaurants.is_open), which hides the whole menu at once.
  available INTEGER NOT NULL DEFAULT 1,
  prep_time_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- One "customization group" per row — e.g. "Size" (required, pick one) or
-- "Extras" (optional, pick several). required + multi_select together
-- describe every real-world shape: required+!multi = must pick exactly
-- one; !required+multi = pick any number, including none.
CREATE TABLE IF NOT EXISTS menu_item_options (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  multi_select INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_menu_item_options_item ON menu_item_options(menu_item_id);

CREATE TABLE IF NOT EXISTS menu_item_option_choices (
  id TEXT PRIMARY KEY,
  option_id TEXT NOT NULL REFERENCES menu_item_options(id),
  name TEXT NOT NULL,
  -- Added to the item's base price when this choice is picked — 0 for a
  -- "Regular" size, positive for "Large", etc. Never negative in this
  -- phase (a discount-style choice isn't a case anyone's asked for yet).
  price_delta INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_menu_item_option_choices_option ON menu_item_option_choices(option_id);
