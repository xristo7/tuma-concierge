"use client";

import type { OrderDetail } from "@tuma/shared";
import { MapPin } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OrderChat } from "../../../components/OrderChat";
import { api, errorMessage } from "../../../lib/api";
import { formatUgx, jobTitle, stageLabel } from "../../../lib/order-display";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etaMinutes, setEtaMinutes] = useState("15");
  const [originalName, setOriginalName] = useState("");
  const [substituteName, setSubstituteName] = useState("");
  const [priceDelta, setPriceDelta] = useState("0");

  const load = useCallback(async () => {
    const res = await api.getOrder(orderId);
    setDetail(res);
    return res;
  }, [orderId]);

  useEffect(() => {
    load().catch(() => {});
    const interval = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(interval);
  }, [load]);

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
    return <div className="p-4 text-sm text-ink-500">Loading job…</div>;
  }

  const { order, items, substitutions } = detail;
  const canDeliver = ["Shop", "Substitute", "Approve"].includes(order.stage);
  const canPropose = order.type === "shopping" && (order.stage === "Shop" || order.stage === "Substitute");

  return (
    <div className="space-y-6 px-4 pb-24 pt-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-ink">{jobTitle(order)}</h1>
        <p className="text-sm font-semibold text-green">{stageLabel(order.stage, order.type)}</p>
        {order.type === "parcel" && order.pickup_area && (
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <MapPin className="h-3.5 w-3.5 text-ink-500" strokeWidth={2} aria-hidden />
            Pickup: {order.pickup_area}
            {order.pickup_address ? ` · ${order.pickup_address}` : ""}
          </p>
        )}
        {order.destination_area && (
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <MapPin className="h-3.5 w-3.5 text-ink-500" strokeWidth={2} aria-hidden />
            {order.type === "parcel" ? "Deliver to: " : ""}
            {order.destination_area}
            {order.destination_address ? ` · ${order.destination_address}` : ""}
          </p>
        )}
      </header>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {order.type === "shopping" ? (
        <section className="home-card space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Shopping list</h2>
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
      ) : (
        <section className="home-card flex justify-between text-sm font-semibold">
          <span>Delivery fee</span>
          <span>{formatUgx(order.final_total ?? order.estimated_total)}</span>
        </section>
      )}

      <section className="home-card space-y-3">
        {["Create", "Match", "Fund"].includes(order.stage) && (
          <p className="text-sm text-ink-500">Waiting on the customer to fund this order.</p>
        )}

        {canPropose && (
          <>
            <h3 className="text-sm font-semibold text-ink">Propose a substitution</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  api.proposeSubstitution(orderId, {
                    originalName,
                    substituteName,
                    priceDelta: Number(priceDelta) || 0,
                  }),
                ).then(() => {
                  setOriginalName("");
                  setSubstituteName("");
                  setPriceDelta("0");
                });
              }}
              className="space-y-2"
            >
              <input
                required
                value={originalName}
                onChange={(e) => setOriginalName(e.target.value)}
                placeholder="Original item"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <input
                required
                value={substituteName}
                onChange={(e) => setSubstituteName(e.target.value)}
                placeholder="Substitute item"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <input
                value={priceDelta}
                onChange={(e) => setPriceDelta(e.target.value.replace(/[^-\d]/g, ""))}
                inputMode="numeric"
                placeholder="Price change (UGX, can be negative)"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
              >
                Send for approval
              </button>
            </form>
          </>
        )}

        {substitutions.length > 0 && (
          <ul className="space-y-1.5">
            {substitutions.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  {sub.original_name} → {sub.substitute_name}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    sub.status === "approved"
                      ? "bg-green/15 text-green"
                      : sub.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-[#ECE8E2] text-ink-500"
                  }`}
                >
                  {sub.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canDeliver && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api.deliverOrder(orderId, Number(etaMinutes) || undefined));
            }}
            className="flex items-center gap-2 border-t border-[var(--border-faint)] pt-3"
          >
            <input
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="ETA (min)"
              className="w-24 rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-sm outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 flex-1 rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
            >
              Start delivery
            </button>
          </form>
        )}

        {order.stage === "Deliver" && (
          <p className="text-sm text-ink-500">
            On the way{order.eta_minutes ? ` — ~${order.eta_minutes} min` : ""}. Ask the customer to confirm
            handover in their app once you arrive.
          </p>
        )}

        {order.stage === "Handover" && (
          <>
            <p className="text-sm text-ink-500">Handover confirmed. Collect your payout.</p>
            <button
              disabled={busy}
              onClick={() => run(() => api.settleOrder(orderId))}
              className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
            >
              Settle & get paid
            </button>
          </>
        )}

        {order.stage === "Settle" && (
          <p className="text-sm font-semibold text-green">
            Completed — {formatUgx(order.final_total ?? order.estimated_total)} settled.
          </p>
        )}
      </section>

      <OrderChat orderId={orderId} />
    </div>
  );
}
