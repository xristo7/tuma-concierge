"use client";

import { Loader2, Mic, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useVoiceNoteMaxSeconds } from "../../lib/useVoiceNoteMaxSeconds";

type Status = "idle" | "recording" | "recorded" | "transcribing" | "error";

export function VoiceNoteRecorder({
  onItemsExtracted,
}: {
  onItemsExtracted: (items: Array<{ name: string; quantity: number }>) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ transcript: string; count: number } | null>(null);
  const maxSeconds = useVoiceNoteMaxSeconds();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Nobody's meant to record minutes of audio here — auto-stop (not just
  // warn) once the admin-set cap is hit.
  useEffect(() => {
    if (status === "recording" && seconds >= maxSeconds) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, status, maxSeconds]);

  async function startRecording() {
    setError(null);
    setLastResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
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
    if (!blobRef.current) return;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = URL.createObjectURL(blobRef.current);
    new Audio(audioUrlRef.current).play().catch(() => {});
  }

  function reset() {
    blobRef.current = null;
    setStatus("idle");
    setSeconds(0);
    setError(null);
    setLastResult(null);
  }

  async function useThisRecording() {
    if (!blobRef.current) return;
    setStatus("transcribing");
    setError(null);
    try {
      const res = await api.transcribeVoiceNote(blobRef.current);
      if (res.items.length === 0) {
        setError("Couldn't make out any items in that recording. Try again, speaking item by item.");
        setStatus("recorded");
        return;
      }
      onItemsExtracted(res.items);
      setLastResult({ transcript: res.transcript, count: res.items.length });
      setStatus("idle");
      blobRef.current = null;
    } catch (err) {
      setError(errorMessage(err));
      setStatus("recorded");
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-[var(--border-faint)] p-3">
      {status === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="mx-auto flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-bold text-ink-gold"
        >
          <Mic className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          Record a voice note
        </button>
      )}

      {status === "recording" && (
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
          <span className="text-sm font-semibold text-ink">
            Recording… {seconds}s / {maxSeconds}s
          </span>
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

      {status === "recorded" && (
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
          <button
            type="button"
            onClick={useThisRecording}
            className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-ink-gold"
          >
            Use this recording
          </button>
        </div>
      )}

      {status === "transcribing" && (
        <div className="flex items-center justify-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} aria-hidden />
          Listening and adding items…
        </div>
      )}

      {lastResult && (
        <p className="text-center text-xs text-green">
          Added {lastResult.count} item{lastResult.count === 1 ? "" : "s"} from your voice note — check the list below.
        </p>
      )}
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
      {status === "idle" && !lastResult && !error && (
        <p className="text-center text-xs text-ink-500">Or type items below instead.</p>
      )}
    </div>
  );
}
