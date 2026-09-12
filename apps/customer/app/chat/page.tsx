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

  if (order === undefined) return <div className="p-4 text-sm text-ink-500">Loading…</div>;

  if (!order) {
    return (
      <div className="space-y-3 p-4 text-center">
        <h1 className="text-xl font-bold text-ink">Chat</h1>
        <p className="text-sm text-ink-500">You have no active order to chat about.</p>
        <Link href="/orders/new" className="text-sm font-semibold text-gold">
          Send a shopping list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
      <div className="flex items-center gap-3">
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
      </div>
      <OrderChat orderId={order.id} />
    </div>
  );
}
