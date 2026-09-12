"use client";

import type { OrderDetail } from "@tuma/shared";
import { MapPin } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OrderChat } from "../../../components/OrderChat";
import { api, errorMessage } from "../../../lib/api";
import { formatUgx, orderTitle, stageLabel } from "../../../lib/order-display";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const router = useRouter();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.getOrder(orderId);
    setDetail(res);
    const pending = res.payments.find((p) => p.status === "pending");
    if (pending) {
      api.refreshPayment(pending.id).catch(() => {});
    }
    return res;
  }, [orderId]);

  useEffect(() => {
    load().catch(() => {});
    const interval = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(interval);
  }, [load]);

  // Creating/matching/funding are handled on the payment screen — if a
  // customer lands here before that's done, send them back to finish it.
  useEffect(() => {
    if (!detail) return;
    if (["Create", "Match", "Fund"].includes(detail.order.stage)) {
      router.replace(`/orders/${orderId}/pay`);
    }
  }, [detail, orderId, router]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <div className="p-4 text-sm text-ink-500">Loading order…</div>;
  }

  const { order, items, substitutions } = detail;
  const pendingSubs = substitutions.filter((s) => s.status === "pending");

  return (
    <div className="space-y-6 px-4 pb-24 pt-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-ink">{orderTitle(order)}</h1>
        <p className="text-sm font-semibold text-green">{stageLabel(order.stage)}</p>
        {order.destination_area && (
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <MapPin className="h-3.5 w-3.5 text-ink-500" strokeWidth={2} aria-hidden />
            {order.destination_area}
            {order.destination_address ? ` · ${order.destination_address}` : ""}
          </p>
        )}
      </header>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="home-card space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Items</h2>
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm text-ink">
              <span>
                {item.quantity}× {item.name}
              </span>
              {item.note && <span className="text-xs text-ink-500">{item.note}</span>}
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-[var(--border-faint)] pt-2 text-sm font-semibold">
          <span>Total</span>
          <span>{formatUgx(order.final_total ?? order.estimated_total)}</span>
        </div>
      </section>

      <section className="home-card space-y-3">
        {(order.stage === "Shop" || order.stage === "Substitute") && (
          <>
            <p className="text-sm text-ink-500">Your rider is shopping.</p>
            {pendingSubs.length > 0 && (
              <ul className="space-y-2">
                {pendingSubs.map((sub) => (
                  <li key={sub.id} className="rounded-xl border border-[var(--border-faint)] p-3">
                    <p className="text-sm text-ink">
                      Swap <strong>{sub.original_name}</strong> for <strong>{sub.substitute_name}</strong>
                      {sub.price_delta !== 0 && (
                        <span className="text-ink-500"> ({sub.price_delta > 0 ? "+" : ""}{formatUgx(sub.price_delta)})</span>
                      )}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() => run(() => api.decideSubstitution(orderId, sub.id, true))}
                        className="flex-1 rounded-full bg-green px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => run(() => api.decideSubstitution(orderId, sub.id, false))}
                        className="flex-1 rounded-full bg-[#ECE8E2] px-3 py-2 text-xs font-bold text-ink disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {order.stage === "Approve" && <p className="text-sm text-ink-500">Waiting for your rider to start delivery.</p>}

        {order.stage === "Deliver" && (
          <>
            <p className="text-sm text-ink-500">
              Your rider is on the way{order.eta_minutes ? ` — ~${order.eta_minutes} min` : ""}.
            </p>
            {order.pin_code && (
              <div className="rounded-xl bg-gold/10 p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Handover PIN</p>
                <p className="text-2xl font-bold tracking-[0.3em] text-ink">{order.pin_code}</p>
              </div>
            )}
            <button
              disabled={busy}
              onClick={() => run(() => api.handoverOrder(orderId, order.pin_code as string))}
              className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
            >
              Confirm I received my order
            </button>
          </>
        )}

        {order.stage === "Handover" && (
          <>
            <p className="text-sm text-ink-500">Handover confirmed. Complete payment to your rider.</p>
            <button
              disabled={busy}
              onClick={() => run(() => api.settleOrder(orderId))}
              className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
            >
              Settle order
            </button>
          </>
        )}

        {order.stage === "Settle" && <p className="text-sm font-semibold text-green">Delivered — thank you!</p>}
      </section>

      <OrderChat orderId={orderId} />
    </div>
  );
}
