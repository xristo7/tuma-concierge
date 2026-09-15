-- Lets a rider bundle several item changes (unavailable / price change) into
-- one review-and-approve action for the customer, instead of one substitution
-- at a time. Existing single substitutions just have a NULL batch_id and
-- keep working exactly as before.

ALTER TABLE substitutions ADD COLUMN batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_substitutions_batch ON substitutions(order_id, batch_id);
