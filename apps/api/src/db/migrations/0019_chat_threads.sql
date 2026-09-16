-- Denormalized from the order at send-time so a customer/rider pair's chat
-- reads as one continued conversation across every order they've shared,
-- not a fresh blank thread each time (see apps/api/src/orders/routes.ts:
-- GET /orders/:id/chat and GET /chat/threads).
ALTER TABLE chat_messages ADD COLUMN customer_id TEXT;
ALTER TABLE chat_messages ADD COLUMN rider_id TEXT;

UPDATE chat_messages SET
  customer_id = (SELECT customer_id FROM orders WHERE orders.id = chat_messages.order_id),
  rider_id = (SELECT rider_id FROM orders WHERE orders.id = chat_messages.order_id)
WHERE customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(customer_id, rider_id);
