"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

type Status = "idle" | "recording" | "transcribing" | "error";

/** Small mic button that records, transcribes (plain dictation, no item
 * extraction), and hands the text off — for short dictated notes like a
 * rider's reason for a fee change, not a shopping list. */
export function VoiceReasonRecorder({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setStatus("transcribing");
        try {
          const res = await api.transcribeVoiceNote(blob, { extractItems: false });
          if (!res.transcript) {
            setError("Couldn't make that out — try again.");
            setStatus("error");
            return;
          }
          onTranscript(res.transcript);
          setStatus("idle");
        } catch {
          setError("Couldn't transcribe that. Try again.");
          setStatus("error");
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
    } catch {
      setError("Couldn't access your microphone.");
      setStatus("error");
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop();
  }

  return (
    <div className="flex items-center gap-2">
      {status === "idle" || status === "error" ? (
        <button
          type="button"
          onClick={start}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink-500 hover:text-ink"
          aria-label="Dictate a reason"
        >
          <Mic className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : status === "recording" ? (
        <button
          type="button"
          onClick={stop}
          className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-red-600 text-white"
          aria-label="Stop recording"
        >
          <Square className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} aria-hidden />
        </span>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
