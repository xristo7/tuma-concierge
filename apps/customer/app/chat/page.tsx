"use client";

import type { OrderRow } from "@tuma/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderChat } from "../../components/OrderChat";
import { api } from "../../lib/api";
import { stageLabel } from "../../lib/order-display";

export default function ChatPage() {
  const [order, setOrder] = useState<OrderRow | null | undefined>(undefined);

  useEffect(() => {
    api
      .getActiveOrder()
      .then((res) => setOrder(res.activeOrder))
      .catch(() => setOrder(null));
  }, []);

  if (order === undefined) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-ink-500">Loading…</div>;
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center space-y-3 p-4 text-center">
        <h1 className="text-xl font-bold text-ink">Chat</h1>
        <p className="text-sm text-ink-500">You have no active order to chat about.</p>
        <Link href="/orders/new" className="text-sm font-semibold text-gold">
          Send a shopping list
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-14">
      <div className="mx-auto flex h-full max-w-lg flex-col bg-cream">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border-faint)] bg-cream/95 px-4 py-3 backdrop-blur-sm">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
            R
            {order.rider_id && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-cream bg-green" />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-ink">
              {order.rider_id ? "Your rider" : "Finding a rider…"}
            </h1>
            <p className="text-xs text-ink-500">{stageLabel(order.stage)}</p>
          </div>
        </header>
        <OrderChat orderId={order.id} variant="full" />
      </div>
    </div>
  );
}
