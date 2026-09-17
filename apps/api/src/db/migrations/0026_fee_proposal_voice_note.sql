-- A rider explaining an out-of-range fee bump may not speak English well
-- enough to type it, and transcribing to text produces gibberish for a
-- non-English recording (see apps/api/src/orders/routes.ts's voice-note
-- handling, which deliberately never transcribes for the same reason).
-- This lets the reason travel as raw audio instead, alongside — not
-- instead of — the optional typed reason.
ALTER TABLE fee_proposals ADD COLUMN reason_voice_key TEXT;
