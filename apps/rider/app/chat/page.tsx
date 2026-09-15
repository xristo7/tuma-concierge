"use client";

import type { ChatThread } from "@tuma/shared";
import { User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

function formatTime(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatListPage() {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getChatThreads()
      .then((res) => {
        if (!cancelled) setThreads(res.threads);
      })
      .catch(() => {
        if (!cancelled) setThreads([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (threads === null) {
    return <div className="p-4 text-sm text-ink-500">Loading…</div>;
  }

  if (threads.length === 0) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center space-y-2 p-4 text-center">
        <h1 className="text-xl font-bold text-ink">Chat</h1>
        <p className="text-sm text-ink-500">No conversations yet — they&apos;ll show up here once you take a job.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Chat</h1>
      <ul className="space-y-2">
        {threads.map((t) => (
          <li key={t.counterpartId}>
            <Link
              href={`/chat/${t.counterpartId}`}
              className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                <User className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{t.counterpartName}</span>
                <span className="block truncate text-xs text-ink-500">{t.lastMessagePreview}</span>
              </span>
              <span className="shrink-0 text-[11px] text-ink-500">{formatTime(t.lastMessageAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
