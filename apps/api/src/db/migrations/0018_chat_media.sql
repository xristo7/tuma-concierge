ALTER TABLE chat_messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'voice'));
ALTER TABLE chat_messages ADD COLUMN media_key TEXT;
