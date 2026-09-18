"use client";

import { Loader2, Pause, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api";

type Status = "idle" | "loading" | "playing" | "error";

/** Plays back the raw voice note attached to an order — spoken context a
 * typed list can miss (units, brand, exactly where in the shop). */
export function VoiceNotePlayer({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  async function toggle() {
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("idle");
      return;
    }
    if (urlRef.current && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setStatus("playing");
      return;
    }
    setStatus("loading");
    try {
      const blob = await api.orderVoiceNoteBlob(orderId);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => setStatus("idle");
      audioRef.current = audio;
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={status === "loading"}
      className="flex items-center gap-2 rounded-full border border-gold bg-gold/10 px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"
    >
      {status === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} aria-hidden />
      ) : status === "playing" ? (
        <Pause className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      ) : (
        <Volume2 className="h-4 w-4 text-gold" strokeWidth={2.25} aria-hidden />
      )}
      {status === "error" ? "Couldn't load voice note" : status === "playing" ? "Playing…" : "Play your voice note"}
    </button>
  );
}
