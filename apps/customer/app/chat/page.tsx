"use client";

import type { OrderRow } from "@tuma/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderChat } from "../../components/OrderChat";
import { api } from "../../lib/api";
import { orderTitle } from "../../lib/order-display";

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
      <div>
        <h1 className="text-xl font-bold text-ink">Chat</h1>
        <p className="text-sm text-ink-500">{orderTitle(order)}</p>
      </div>
      <OrderChat orderId={order.id} />
    </div>
  );
}
