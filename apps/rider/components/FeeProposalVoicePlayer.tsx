"use client";

import { Loader2, Pause, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api";

type Status = "idle" | "loading" | "playing" | "error";

/** Plays back the rider's own spoken reason for a fee change — deliberately
 * not transcribed, since a non-English recording would just come back as
 * gibberish text. */
export function FeeProposalVoicePlayer({ orderId, proposalId }: { orderId: string; proposalId: string }) {
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
      const blob = await api.feeProposalVoiceNoteBlob(orderId, proposalId);
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
      className="mt-1 flex items-center gap-1.5 rounded-full border border-gold bg-gold/10 px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-60"
    >
      {status === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} aria-hidden />
      ) : status === "playing" ? (
        <Pause className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      ) : (
        <Volume2 className="h-3.5 w-3.5 text-gold" strokeWidth={2.25} aria-hidden />
      )}
      {status === "error" ? "Couldn't load voice note" : status === "playing" ? "Playing…" : "Play voice reason"}
    </button>
  );
}
