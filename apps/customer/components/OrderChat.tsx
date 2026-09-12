"use client";

import type { ChatMessage } from "@tuma/shared";
import { Send } from "lucide-react";
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

export function OrderChat({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Chat</h2>

      <div className="max-h-80 space-y-3 overflow-y-auto rounded-[28px] bg-[#F4F1EC] p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-ink-500">
            No messages yet — say hello to your rider.
          </p>
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
                  className={`px-4 py-2.5 text-[14px] leading-snug shadow-sm ${
                    mine
                      ? "rounded-[20px] rounded-br-md bg-gold text-ink"
                      : "rounded-[20px] rounded-bl-md bg-white text-ink"
                  }`}
                >
                  {m.body}
                </div>
                <span className="mt-1 px-1 text-[10px] text-ink-500/70">{formatTime(m.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-full border border-[var(--border-faint)] bg-white px-4 py-3 text-sm outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" strokeWidth={2.25} />
        </button>
      </form>
    </section>
  );
}
