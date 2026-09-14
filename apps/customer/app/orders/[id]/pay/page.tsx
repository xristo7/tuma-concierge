"use client";

import type { OrderDetail } from "@tuma/shared";
import { TriangleAlert } from "lucide-react";
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

  // Silently find a rider as soon as we land here, then keep retrying on a
  // fixed 4s cadence until one is found. Depends only on stable primitives
  // (stage, rider_id) rather than `detail` itself — `detail` is a brand-new
  // object on every load(), so keying on it re-fires this effect on every
  // poll tick, and a failed matchOrder's `finally` calling load() would
  // immediately re-trigger another matchOrder with no delay at all: an
  // unbounded, zero-delay retry loop whenever no rider is available yet
  // (this is what took the API down — see incident notes).
  const stage = detail?.order.stage;
  const riderId = detail?.order.rider_id;
  useEffect(() => {
    if (!detail || stage !== "Create" || riderId) return;
    let cancelled = false;

    async function attempt() {
      if (matching.current) return;
      matching.current = true;
      try {
        await api.matchOrder(orderId);
      } catch {
        // no rider available yet — the interval below retries in 4s
      } finally {
        matching.current = false;
        if (!cancelled) load().catch(() => {});
      }
    }

    attempt();
    const interval = setInterval(attempt, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, stage, riderId]);

  // Poll payment status while a MoMo collection is pending. Keyed on the
  // pending payment's id (stable across reloads that don't change it)
  // rather than `detail`, for the same reason as above.
  const pendingPaymentId = detail?.payments.find((p) => p.status === "pending")?.id;
  useEffect(() => {
    if (!pendingPaymentId) return;
    const interval = setInterval(() => {
      api
        .refreshPayment(pendingPaymentId)
        .then(() => load())
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPaymentId]);

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

        {hasRider && !!order.matched_out_of_range && (
          <div className="flex items-start gap-2 rounded-xl border border-gold bg-gold/10 p-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
            <p className="text-sm text-ink">
              Your rider is available but currently outside the normal service area, so this delivery may
              cost a little more than usual.
            </p>
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
