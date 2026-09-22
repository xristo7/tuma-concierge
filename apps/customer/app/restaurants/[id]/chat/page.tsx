"use client";

import type { RestaurantChatMessage } from "@tuma/shared";
import { ArrowLeft, Camera, Send, Store } from "lucide-react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../../../lib/api";
import { compressImage } from "../../../../lib/image-compress";
import { useLivePolling } from "../../../../lib/use-live-polling";

function formatTime(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ImageBubble({ messageId }: { messageId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .restaurantChatMediaBlob(messageId)
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

  if (!url) return <div className="h-40 w-48 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />;
  return (
    <PhotoView src={url}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Photo" className="max-h-64 w-full max-w-[220px] cursor-zoom-in rounded-2xl object-cover" />
    </PhotoView>
  );
}

export default function RestaurantChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [messages, setMessages] = useState<RestaurantChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Arriving from "Ask about this item" on a menu item — attaches that item
  // to the first message sent, so the restaurant knows exactly what a
  // free-form "is this spicy?" is about.
  const menuItemId = searchParams.get("item");
  const menuItemName = searchParams.get("itemName");

  const load = useCallback(async () => {
    const res = await api.getRestaurantChat(id);
    setRestaurantName(res.restaurantName);
    setMessages(res.messages);
    return res;
  }, [id]);

  useLivePolling(() => void load().catch(() => {}), 4000, [load]);

  useEffect(() => {
    api.markRestaurantChatRead(id).catch(() => {});
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await api.sendRestaurantChat(id, body, menuItemId && menuItemName ? { id: menuItemId, name: menuItemName } : undefined);
      setDraft("");
      if (menuItemId) router.replace(`/restaurants/${id}/chat`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file: File) {
    setSending(true);
    setError(null);
    try {
      const compressed = await compressImage(file, { maxDimension: 1280, quality: 0.75 });
      await api.sendRestaurantChatImage(id, compressed);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-2.5">
        <Link
          href={`/restaurants/${id}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-500"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </Link>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <Store className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-ink">{restaurantName ?? "Chat"}</h1>
      </header>

      <PhotoProvider>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-ink-500">
              No messages yet — ask about opening hours, an item, or anything else.
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_role === "customer";
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {m.menu_item_name && (
                  <span className="mb-1 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-semibold text-ink-500">
                    Re: {m.menu_item_name}
                  </span>
                )}
                <div
                  className={`max-w-[80%] text-[14px] leading-snug shadow-sm ${m.type === "text" ? "px-4 py-2.5" : "p-1.5"} ${
                    mine
                      ? "rounded-[20px] rounded-br-md bg-gold text-[#0A0A0A]"
                      : "rounded-[20px] rounded-bl-md bg-[rgb(var(--surface-card))] text-ink"
                  }`}
                >
                  {m.type === "image" ? <ImageBubble messageId={m.id} /> : m.body}
                </div>
                <span className="mt-1 px-1 text-[10px] text-ink-500/70">{formatTime(m.created_at)}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </PhotoProvider>

      {menuItemName && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-faint)] bg-gold/10 px-3 py-2">
          <span className="truncate text-xs font-semibold text-ink">Asking about: {menuItemName}</span>
          <button
            type="button"
            onClick={() => router.replace(`/restaurants/${id}/chat`)}
            className="shrink-0 text-xs font-bold text-ink-500"
          >
            Clear
          </button>
        </div>
      )}

      {error && <p className="shrink-0 px-3 py-1 text-xs text-red-600">{error}</p>}

      <form
        onSubmit={sendText}
        className="flex shrink-0 items-center gap-2 border-t border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-2.5"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void sendImage(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-500 disabled:opacity-40"
          aria-label="Send a photo"
        >
          <Camera className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={menuItemName ? `Ask about ${menuItemName}…` : "Message…"}
          className="min-w-0 flex-1 rounded-full border border-[var(--border-faint)] bg-cream px-4 py-2.5 text-[15px] outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-[#0A0A0A] shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
      </form>
    </div>
  );
}
