"use client";

import type { ChatMessage } from "@tuma/shared";
import { Camera, Mic, Pause, Play, Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const ROLE_STYLES: Record<string, { bg: string; label: string }> = {
  customer: { bg: "bg-green", label: "C" },
  rider: { bg: "bg-gold", label: "R" },
  admin: { bg: "bg-ink", label: "A" },
};

function formatTime(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ImageBubble({ messageId, dark }: { messageId: string; dark: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .chatMediaBlob(messageId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  if (!url) return <div className={`h-40 w-48 animate-pulse rounded-2xl ${dark ? "bg-white/10" : "bg-black/5"}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Photo" className="max-h-64 w-full max-w-[220px] rounded-2xl object-cover" />;
}

function VoiceBubble({
  messageId,
  mine,
  dark,
}: {
  messageId: string;
  mine: boolean;
  dark: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

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
      const blob = await api.chatMediaBlob(messageId);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => setStatus("idle");
      audioRef.current = audio;
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <button type="button" onClick={toggle} className="flex items-center gap-2 py-0.5 pr-2">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-black/10" : dark ? "bg-white/10" : "bg-black/5"
        }`}
      >
        {status === "playing" ? (
          <Pause className="h-4 w-4" strokeWidth={2} aria-hidden />
        ) : (
          <Play className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
      </span>
      <span className="text-[13px]">{status === "loading" ? "Loading…" : "Voice message"}</span>
    </button>
  );
}

type Props = {
  orderId: string;
  /** "embedded" (default) sits inside a longer page as a bounded card, in the page's own theme.
   * "full" fills its parent's height edge-to-edge for a dedicated chat screen, WhatsApp-dark. */
  variant?: "embedded" | "full";
};

export function OrderChat({ orderId, variant = "embedded" }: Props) {
  const dark = variant === "full";
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api
      .getChat(orderId)
      .then((res) => setMessages(res.messages))
      .catch(() => {});
  }, [orderId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setDraft("");
    try {
      await api.sendChat(orderId, body);
      load();
    } finally {
      setSending(false);
    }
  }

  async function pickPhoto(file: File) {
    setSending(true);
    try {
      await api.sendChatMedia(orderId, "image", file);
      load();
    } finally {
      setSending(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setSending(true);
        try {
          await api.sendChatMedia(orderId, "voice", blob);
          load();
        } finally {
          setSending(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      // mic permission denied or unavailable — silently no-op, same as leaving it untapped
    }
  }

  function stopRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);
    mediaRecorderRef.current?.stop();
  }

  const incomingBubble = dark ? "bg-[#1f2c34] text-white" : "bg-[rgb(var(--surface-card))] text-ink";
  const mutedText = dark ? "text-white/50" : "text-ink-500";
  const timeText = dark ? "text-white/40" : "text-ink-500/70";

  const bubbles = (
    <>
      {messages.length === 0 && (
        <p className={`py-8 text-center text-xs ${mutedText}`}>No messages yet — say hello to your rider.</p>
      )}
      {messages.map((m, i) => {
        const mine = m.sender_id === user?.id;
        const prev = messages[i - 1];
        const showAvatar = !mine && (!prev || prev.sender_id !== m.sender_id);
        const role = ROLE_STYLES[m.sender_role] ?? ROLE_STYLES.admin;

        return (
          <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
            {!mine && (
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                  showAvatar ? role.bg : "opacity-0"
                }`}
                aria-hidden
              >
                {role.label}
              </span>
            )}
            <div className={`flex max-w-[75%] flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`text-[14px] leading-snug shadow-sm ${m.type === "text" ? "px-4 py-2.5" : "p-1.5"} ${
                  mine ? "rounded-[20px] rounded-br-md bg-gold text-ink" : `rounded-[20px] rounded-bl-md ${incomingBubble}`
                }`}
              >
                {m.type === "image" && <ImageBubble messageId={m.id} dark={dark} />}
                {m.type === "voice" && <VoiceBubble messageId={m.id} mine={mine} dark={dark} />}
                {m.type === "text" && m.body}
              </div>
              <span className={`mt-1 px-1 text-[10px] ${timeText}`}>{formatTime(m.created_at)}</span>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </>
  );

  const composer = (
    <form onSubmit={send} className="flex items-center gap-2">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pickPhoto(file);
        }}
      />
      <button
        type="button"
        onClick={() => photoInputRef.current?.click()}
        disabled={sending || recording}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
          dark ? "text-white/70" : "text-ink-500"
        }`}
        aria-label="Send a photo"
      >
        <Camera className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </button>

      <div className="relative min-w-0 flex-1">
        {recording ? (
          <div
            className={`flex h-[46px] items-center gap-2 rounded-full pl-4 pr-2 ${
              dark ? "bg-[#1f2c34]" : "bg-[rgb(var(--surface-muted))]"
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className={`flex-1 text-sm ${dark ? "text-white" : "text-ink"}`}>Recording… {recordSeconds}s</span>
          </div>
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message…"
            className={`w-full rounded-full border py-3.5 pl-4 pr-4 text-sm outline-none focus:border-gold ${
              dark
                ? "border-white/10 bg-[#1f2c34] text-white placeholder:text-white/40"
                : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink"
            }`}
          />
        )}
      </div>

      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"
          aria-label="Stop and send voice message"
        >
          <Square className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </button>
      ) : draft.trim() ? (
        <button
          type="submit"
          disabled={sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" strokeWidth={2.25} />
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-40"
          aria-label="Record a voice message"
        >
          <Mic className="h-5 w-5" strokeWidth={2.25} />
        </button>
      )}
    </form>
  );

  if (variant === "full") {
    return (
      <div className="flex h-full flex-col bg-[#0b141a]">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">{bubbles}</div>
        <div className="shrink-0 border-t border-white/10 bg-[#0b141a] px-3 py-2.5">{composer}</div>
      </div>
    );
  }

  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Chat</h2>
      <div className="max-h-80 space-y-3 overflow-y-auto rounded-[28px] bg-[#F4F1EC] p-4">{bubbles}</div>
      {composer}
    </section>
  );
}
