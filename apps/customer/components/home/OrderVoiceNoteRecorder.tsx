"use client";

import { Mic, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "recording" | "recorded" | "error";

/** Records a short voice note and hands the raw audio Blob up to the parent
 * — this is NOT transcribed or turned into list items. It's meant to be
 * played back as-is by whoever picks up the order: spoken context a typed
 * list can miss (units, brand, exactly where in the shop to find it). */
export function OrderVoiceNoteRecorder({
  blob,
  onChange,
}: {
  blob: Blob | null;
  onChange: (blob: Blob | null) => void;
}) {
  const [status, setStatus] = useState<Status>(blob ? "recorded" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        onChange(recorded);
        setStatus("recorded");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Couldn't access your microphone. Check your browser's mic permission.");
      setStatus("error");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function playBack() {
    if (!blob) return;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = URL.createObjectURL(blob);
    new Audio(audioUrlRef.current).play().catch(() => {});
  }

  function reset() {
    onChange(null);
    setStatus("idle");
    setSeconds(0);
    setError(null);
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-[var(--border-faint)] p-3">
      <p className="text-center text-xs font-semibold text-ink-500">
        Voice note for your rider <span className="font-normal">(optional)</span>
      </p>

      {status === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="mx-auto flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-bold text-ink"
        >
          <Mic className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          Record a voice note
        </button>
      )}

      {status === "recording" && (
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
          <span className="text-sm font-semibold text-ink">Recording… {seconds}s</span>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-faint)] px-3 py-1.5 text-xs font-bold text-ink"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Stop
          </button>
        </div>
      )}

      {status === "recorded" && blob && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={playBack}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-faint)] px-3 py-1.5 text-xs font-bold text-ink"
          >
            <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Play back
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-faint)] px-3 py-1.5 text-xs font-bold text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Re-record
          </button>
        </div>
      )}

      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
