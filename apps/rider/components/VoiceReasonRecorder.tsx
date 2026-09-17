"use client";

import { CheckCircle2, Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useVoiceNoteMaxSeconds } from "../lib/useVoiceNoteMaxSeconds";

type Status = "idle" | "recording" | "recorded";

/** Records a short voice note explaining a fee change and hands back the
 * raw audio Blob — deliberately NOT transcribed. A rider explaining an
 * out-of-range bump may not be comfortable typing (or speaking) in
 * English, and transcribing a non-English recording just produces
 * gibberish text, so this travels as audio instead, alongside whatever
 * they typed. */
export function VoiceReasonRecorder({
  blob,
  onChange,
}: {
  blob: Blob | null;
  onChange: (blob: Blob | null) => void;
}) {
  const [status, setStatus] = useState<Status>(blob ? "recorded" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxSeconds = useVoiceNoteMaxSeconds();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioRef.current?.pause();
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (status === "recording" && seconds >= maxSeconds) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, status, maxSeconds]);

  function resetPlayback() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        resetPlayback();
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
      setError("Couldn't access your microphone.");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function togglePlayback() {
    if (!blob) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!audioRef.current) {
      audioUrlRef.current = URL.createObjectURL(blob);
      const audio = new Audio(audioUrlRef.current);
      audio.onended = () => setPlaying(false);
      audioRef.current = audio;
    }
    audioRef.current.play().catch(() => {});
    setPlaying(true);
  }

  function reRecord() {
    resetPlayback();
    onChange(null);
    setStatus("idle");
  }

  return (
    <div className="flex items-center gap-2">
      {status === "idle" && (
        <button
          type="button"
          onClick={start}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink-500 hover:text-ink"
          aria-label="Record a voice reason"
        >
          <Mic className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      )}
      {status === "recording" && (
        <>
          <button
            type="button"
            onClick={stop}
            className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-red-600 text-white"
            aria-label="Stop recording"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
          <span className="text-xs text-ink-500">
            {seconds}s / {maxSeconds}s
          </span>
        </>
      )}
      {status === "recorded" && (
        <>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold bg-gold/10 text-gold">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink-500"
            aria-label={playing ? "Pause" : "Play back"}
          >
            {playing ? <Pause className="h-3.5 w-3.5" strokeWidth={2} /> : <Play className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
          <button
            type="button"
            onClick={reRecord}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink-500"
            aria-label="Re-record"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
