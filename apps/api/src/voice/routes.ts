import { Hono } from "hono";
import { getAiBinding } from "../ai/binding.js";
import { requireAuth } from "../auth/middleware.js";
import { consume, tooManyRequests } from "../lib/ratelimit.js";

export const voiceRoutes = new Hono();
voiceRoutes.use("*", requireAuth);

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // ~15MB, comfortably covers a couple minutes of speech

/** Every call here runs Whisper and usually Llama too, on up to 15MB of
 * audio — this is the most expensive thing an ordinary signed-in account can
 * ask the platform to do, and nothing about it is worth doing in a loop.
 * Dictating a shopping list a few times an hour is normal use, so an hourly
 * ceiling catches runaway scripts without ever touching a real customer. */
const TRANSCRIBE_PER_HOUR = 30;

type WhisperResponse = { text?: string };

const ITEM_EXTRACTION_SYSTEM_PROMPT = `You turn a spoken shopping list transcript into a JSON array of items.
Rules:
- Output ONLY a JSON array, nothing else — no explanation, no markdown fences.
- Each element is {"name": string, "quantity": number}.
- "name" is the item as said (keep local/brand names as spoken, e.g. "Kimbo", "matooke", "posho").
- "quantity" defaults to 1 if not stated. Convert spoken numbers ("two", "a dozen") to digits.
- Merge duplicate mentions of the same item into one entry.
- If the transcript has no identifiable items, output [].`;

type ExtractedItem = { name: string; quantity: number };

function parseItemsFromModelText(text: string): ExtractedItem[] {
  const match = text.match(/\[[\s\S]*\]/);
  const jsonText = match ? match[0] : text;
  const parsed = JSON.parse(jsonText) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((it): it is { name: unknown; quantity?: unknown } => typeof it === "object" && it !== null)
    .map((it) => ({
      name: String((it as { name: unknown }).name ?? "").trim(),
      quantity: Math.max(1, Math.round(Number((it as { quantity?: unknown }).quantity) || 1)),
    }))
    .filter((it) => it.name.length > 0)
    .slice(0, 50);
}

voiceRoutes.post("/voice/transcribe", async (c) => {
  const user = c.get("user");
  const quota = await consume(`voice:${user.sub}`, TRANSCRIBE_PER_HOUR, 60 * 60);
  if (!quota.allowed) {
    return tooManyRequests(c, quota, "You've hit the voice-note limit for now. Please try again later.");
  }

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) return c.json({ error: "missing_audio" }, 400);
  if (file.size > MAX_AUDIO_BYTES) return c.json({ error: "file_too_large" }, 400);
  if (file.size === 0) return c.json({ error: "empty_audio" }, 400);
  // Plain dictation (e.g. a rider's reason for a fee change) skips the
  // shopping-item extraction pass entirely — one fewer model call, and
  // there's nothing item-shaped to extract from a sentence like that anyway.
  const extractItems = form?.get("extractItems") !== "false";

  const ai = getAiBinding();

  let transcript: string;
  try {
    const audioBytes = [...new Uint8Array(await file.arrayBuffer())];
    const whisperResult = (await ai.run("@cf/openai/whisper", { audio: audioBytes })) as WhisperResponse;
    transcript = (whisperResult.text ?? "").trim();
  } catch (err) {
    console.error("Whisper transcription failed:", err);
    return c.json({ error: "transcription_failed", message: "Couldn't understand the recording. Please try again." }, 502);
  }

  if (!transcript || !extractItems) {
    return c.json({ transcript, items: [] });
  }

  let items: ExtractedItem[] = [];
  try {
    const llamaResult = (await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: ITEM_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    })) as { response?: string };
    items = parseItemsFromModelText(llamaResult.response ?? "[]");
  } catch (err) {
    // The transcript alone is still useful even if item extraction fails —
    // fall back to it so the customer can type items in manually.
    console.error("Item extraction failed:", err);
  }

  return c.json({ transcript, items });
});
