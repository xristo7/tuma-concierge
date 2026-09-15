"use client";

import type { OrderDetail } from "@tuma/shared";
import { ArrowLeft, User } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderChat } from "../../../../components/OrderChat";
import { api } from "../../../../lib/api";
import { stageLabel } from "../../../../lib/order-display";

export default function JobChatPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const router = useRouter();
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  useEffect(() => {
    api
      .getOrder(orderId)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [orderId]);

  if (!detail) {
    return <div className="flex min-h-dvh items-center justify-center bg-[#0b141a] text-sm text-white/60">Loading…</div>;
  }

  const { order } = detail;

  return (
    <div className="fixed inset-0">
      <div className="mx-auto flex h-full max-w-lg flex-col bg-[#0b141a]">
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#1f2c34] px-3 py-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
            <User className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white">{order.customer_name ?? "Your customer"}</h1>
            <p className="text-xs text-white/50">{stageLabel(order.stage)}</p>
          </div>
        </header>
        <OrderChat orderId={order.id} variant="full" />
      </div>
    </div>
  );
}
