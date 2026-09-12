"use client";

import type { ChatMessage } from "@tuma/shared";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

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
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[var(--border-faint)] bg-white p-3">
        {messages.length === 0 && <p className="py-4 text-center text-xs text-ink-500">No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-gold/20 text-ink" : "bg-[#ECE8E2] text-ink"
                }`}
              >
                <p>{m.body}</p>
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
          placeholder="Message your customer…"
          className="min-w-0 flex-1 rounded-full border border-[var(--border-faint)] px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
    </section>
  );
}
