-- Optional promotional badge a restaurant can put on a menu item — shown
-- on the customer-facing card (see apps/customer/app/restaurants/[id]/page.tsx).
-- Null means no badge, the normal case.
ALTER TABLE menu_items ADD COLUMN badge TEXT CHECK (badge IN ('sale', 'new', 'trending'));
