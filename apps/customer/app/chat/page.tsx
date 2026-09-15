"use client";

import type { OrderRow } from "@tuma/shared";
import { ArrowLeft, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderChat } from "../../components/OrderChat";
import { ShoppingListModal } from "../../components/home/ShoppingListModal";
import { api } from "../../lib/api";
import { stageLabel } from "../../lib/order-display";

export default function ChatPage() {
  const router = useRouter();
  const [order, setOrder] = useState<OrderRow | null | undefined>(undefined);
  const [showNewList, setShowNewList] = useState(false);
  const [riderPhotoUrl, setRiderPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    api
      .getActiveOrder()
      .then((res) => setOrder(res.activeOrder))
      .catch(() => setOrder(null));
  }, []);

  useEffect(() => {
    if (!order?.rider_id) {
      setRiderPhotoUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .riderPhotoBlob(order.rider_id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setRiderPhotoUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [order?.rider_id]);

  if (order === undefined) {
    return <div className="flex min-h-dvh items-center justify-center bg-[#0b141a] text-sm text-white/60">Loading…</div>;
  }

  if (!order) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center space-y-3 bg-cream p-4 text-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-ink"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <h1 className="text-xl font-bold text-ink">Chat</h1>
        <p className="text-sm text-ink-500">You have no active order to chat about.</p>
        <button type="button" onClick={() => setShowNewList(true)} className="text-sm font-semibold text-gold">
          Send a shopping list
        </button>
        {showNewList && <ShoppingListModal onClose={() => setShowNewList(false)} />}
      </div>
    );
  }

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
          {riderPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={riderPhotoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
              <User className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white">
              {order.rider_id ? (order.rider_name ?? "Your rider") : "Finding a rider…"}
            </h1>
            <p className="text-xs text-white/50">{stageLabel(order.stage)}</p>
          </div>
        </header>
        <OrderChat orderId={order.id} variant="full" />
      </div>
    </div>
  );
}
