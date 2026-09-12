"use client";

import type { OrderRow } from "@tuma/shared";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatUgx } from "../../lib/order-display";

export default function WalletPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    api
      .myRiderOrders()
      .then((res) => setOrders(res.orders.filter((o) => o.stage === "Settle")))
      .catch(() => setOrders([]));
  }, []);

  const total = orders.reduce((sum, o) => sum + (o.final_total ?? o.estimated_total ?? 0), 0);

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Wallet</h1>

      <section className="home-card space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total settled</p>
        <p className="text-2xl font-bold text-ink">{formatUgx(total)}</p>
        <p className="text-xs text-ink-500">{orders.length} completed job{orders.length === 1 ? "" : "s"}</p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">History</h2>
        {orders.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No completed jobs yet.</p>}
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="home-card flex items-center justify-between !rounded-2xl !px-3 !py-3">
              <span className="text-sm text-ink">{order.destination_area ?? `Job #${order.id.slice(-6)}`}</span>
              <span className="text-sm font-semibold text-green">
                {formatUgx(order.final_total ?? order.estimated_total)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
