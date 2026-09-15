"use client";

import type { ChatThreadDetail } from "@tuma/shared";
import { ArrowLeft, User } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderChat } from "../../../components/OrderChat";
import { api } from "../../../lib/api";

export default function ChatThreadPage() {
  const params = useParams<{ counterpartId: string }>();
  const counterpartId = params.counterpartId;
  const router = useRouter();
  const [thread, setThread] = useState<ChatThreadDetail | null | undefined>(undefined);

  useEffect(() => {
    api
      .getChatThread(counterpartId)
      .then(setThread)
      .catch(() => setThread(null));
  }, [counterpartId]);

  if (thread === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0b141a] text-sm text-white/60">Loading…</div>
    );
  }

  if (!thread) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cream p-4 text-center">
        <p className="text-sm text-ink-500">Couldn&apos;t load this conversation.</p>
        <button type="button" onClick={() => router.push("/chat")} className="text-sm font-semibold text-gold">
          Back to chats
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0">
      <div className="mx-auto flex h-full max-w-lg flex-col bg-[#0b141a]">
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#1f2c34] px-3 py-2.5">
          <button
            type="button"
            onClick={() => router.push("/chat")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
            <User className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white">{thread.counterpartName}</h1>
          </div>
        </header>
        <OrderChat orderId={thread.orderId} variant="full" />
      </div>
    </div>
  );
}
