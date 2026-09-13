"use client";

import type { OrderDetail } from "@tuma/shared";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../../../lib/api";
import { formatUgx } from "../../../../lib/order-display";

/** Step 2 of 3 — matches a rider in the background, then collects payment.
 * Everything after this (the rider accepting, shopping, delivering) is a
 * separate process the customer just watches on the order tracking page. */
export default function PayPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const router = useRouter();

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [msisdn, setMsisdn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matching = useRef(false);

  const load = useCallback(async () => {
    const res = await api.getOrder(orderId);
    setDetail(res);
    return res;
  }, [orderId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Once funded, the payment webhook/poll advances the order to "Shop" —
  // that's when this step is done and we hand off to the tracking screen.
  useEffect(() => {
    if (!detail) return;
    if (detail.order.stage !== "Create" && detail.order.stage !== "Match" && detail.order.stage !== "Fund") {
      router.replace(`/orders/${orderId}`);
    }
  }, [detail, orderId, router]);

  // Silently find a rider as soon as we land here; retry until one is found.
  useEffect(() => {
    if (!detail || detail.order.stage !== "Create" || matching.current) return;
    matching.current = true;
    api
      .matchOrder(orderId)
      .catch(() => {})
      .finally(() => {
        matching.current = false;
        load().catch(() => {});
      });
  }, [detail, orderId, load]);

  useEffect(() => {
    if (!detail || detail.order.rider_id) return;
    const interval = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(interval);
  }, [detail, load]);

  // Poll payment status while a MoMo collection is pending.
  useEffect(() => {
    if (!detail) return;
    const pending = detail.payments.find((p) => p.status === "pending");
    if (!pending) return;
    const interval = setInterval(() => {
      api
        .refreshPayment(pending.id)
        .then(() => load())
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [detail, load]);

  async function doFund() {
    setBusy(true);
    setError(null);
    try {
      await api.fundOrder(orderId, detail?.order.payment_rail === "escrow" ? { msisdn } : {});
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <div className="p-4 text-sm text-ink-500">Loading…</div>;
  }

  const { order } = detail;
  const hasRider = Boolean(order.rider_id);
  const pendingPayment = detail.payments.find((p) => p.status === "pending");

  return (
    <div className="space-y-6 px-4 pb-24 pt-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">Step 2 of 3 · Pay</p>
        <h1 className="text-xl font-bold text-ink">Payment</h1>
      </div>

      <section className="home-card space-y-2">
        {order.type === "parcel" && (
          <div className="flex justify-between text-sm">
            <span className="text-ink-500">Pickup</span>
            <span className="font-semibold text-ink">{order.pickup_area ?? "—"}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-ink-500">Delivery</span>
          <span className="font-semibold text-ink">{order.destination_area ?? "—"}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--border-faint)] pt-2 text-sm font-semibold">
          <span>Total</span>
          <span>{formatUgx(order.estimated_total)}</span>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="home-card space-y-3">
        {!hasRider && (
          <div className="flex items-center gap-3 py-4">
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="text-sm text-ink-500">Finding a nearby verified rider…</p>
          </div>
        )}

        {hasRider && pendingPayment && (
          <div className="flex items-center gap-3 py-4">
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="text-sm text-ink-500">Confirming your MoMo payment…</p>
          </div>
        )}

        {hasRider && !pendingPayment && (
          <>
            <p className="text-sm text-ink-500">A rider is ready. Pay to send your list.</p>
            {order.payment_rail === "escrow" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  doFund();
                }}
                className="space-y-2"
              >
                <input
                  required
                  value={msisdn}
                  onChange={(e) => setMsisdn(e.target.value)}
                  placeholder="MoMo number (e.g. 256700000099)"
                  className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
                >
                  Pay via MoMo
                </button>
              </form>
            ) : (
              <button
                onClick={doFund}
                disabled={busy}
                className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
              >
                Confirm — rider fronts the cash
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
