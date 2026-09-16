-- WhatsApp-style delivery/read ticks and voice-note played state. "Read" is
-- derived at query time from the existing chat_reads table (per-thread, set
-- by POST /orders/:id/chat/read) — only delivered/played need their own
-- per-message timestamp here.
ALTER TABLE chat_messages ADD COLUMN delivered_at TEXT;
ALTER TABLE chat_messages ADD COLUMN played_at TEXT;
