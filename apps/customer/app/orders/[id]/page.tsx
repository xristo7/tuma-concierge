"use client";

import type { MobileMoneyNetwork, OrderDetail, OrderRating } from "@tuma/shared";
import { detectMobileMoneyNetwork, mobileMoneyNetworkLabel } from "@tuma/shared";
import { MapPin, TriangleAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderChat } from "../../../components/OrderChat";
import { OrderTimeline } from "../../../components/OrderTimeline";
import { RateDeliveryCard } from "../../../components/RateDeliveryCard";
import { VoiceNotePlayer } from "../../../components/VoiceNotePlayer";
import { api, errorMessage } from "../../../lib/api";
import { formatUgx, orderTitle, stageLabel } from "../../../lib/order-display";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msisdn, setMsisdn] = useState("");
  const detectedNetwork = useMemo(() => detectMobileMoneyNetwork(msisdn), [msisdn]);
  const matching = useRef(false);

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

  // Silently find a rider as soon as an unmatched order lands here, then
  // keep retrying on a fixed 4s cadence until one is found. Depends only on
  // stable primitives (stage, rider_id) rather than `detail` itself —
  // `detail` is a brand-new object on every load(), so keying on it re-fires
  // this effect on every poll tick, and a failed matchOrder's `finally`
  // calling load() would immediately re-trigger another matchOrder with no
  // delay at all: an unbounded, zero-delay retry loop whenever no rider is
  // available yet (this is what took the API down — see incident notes).
  // Also covers a funded order whose rider cancelled — it's left in "Match"
  // with rider_id cleared rather than rewound to "Create", since rewinding
  // would re-expose the funding step after money already moved.
  const stage = detail?.order.stage;
  const riderId = detail?.order.rider_id;
  useEffect(() => {
    if (!detail || riderId || (stage !== "Create" && stage !== "Match")) return;
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
    return <div className="p-4 text-sm text-ink-500">Loading order…</div>;
  }

  const { order, items, substitutions, feeProposals } = detail;
  const pendingFeeProposal = feeProposals.find((f) => f.status === "pending");
  const pendingPayment = detail.payments.find((p) => p.status === "pending");
  const awaitingRiderOrPayment = ["Create", "Match", "Fund"].includes(order.stage);
  const pendingSubs = substitutions.filter((s) => s.status === "pending");
  // Group by batch so a rider's multi-item edit shows as one card with one
  // approve/reject action; older single-item proposals (no batch_id) each
  // just form a group of their own, decided via the original endpoint.
  const pendingGroups = Object.values(
    pendingSubs.reduce<Record<string, { key: string; batchId: string | null; subs: typeof pendingSubs }>>(
      (groups, sub) => {
        const key = sub.batch_id ?? sub.id;
        (groups[key] ??= { key, batchId: sub.batch_id, subs: [] }).subs.push(sub);
        return groups;
      },
      {},
    ),
  );

  function decideGroup(group: { batchId: string | null; subs: typeof pendingSubs }, approve: boolean) {
    return group.batchId
      ? api.decideSubstitutionBatch(orderId, group.batchId, approve)
      : api.decideSubstitution(orderId, group.subs[0].id, approve);
  }

  function handleRated(newRating: OrderRating) {
    setDetail((prev) => (prev ? { ...prev, rating: newRating } : prev));
  }

  return (
    <div className="space-y-6 px-4 pb-24 pt-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-ink">{orderTitle(order)}</h1>
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

      <OrderTimeline order={order} events={detail.events} statusLabel={stageLabel(order.stage, order.type)} />

      {order.voice_note_key && <VoiceNotePlayer orderId={orderId} />}

      {!!order.matched_out_of_range && order.rider_id && (
        <div className="flex items-start gap-2 rounded-xl border border-gold bg-gold/10 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
          <p className="text-sm text-ink">
            Your rider is available but currently outside the normal service area, so this delivery may cost
            a little more than usual.
          </p>
        </div>
      )}

      {pendingFeeProposal && (
        <section className="home-card space-y-2 !border-l-4 !border-l-gold">
          <p className="text-sm text-ink">
            Your rider suggests a new total: <strong>{formatUgx(pendingFeeProposal.proposed_total)}</strong>{" "}
            <span className="text-ink-500">(was {formatUgx(pendingFeeProposal.previous_total)})</span>
            {pendingFeeProposal.reason && <span className="block text-ink-500">{pendingFeeProposal.reason}</span>}
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => run(() => api.decideFeeProposal(orderId, pendingFeeProposal.id, true))}
              className="flex-1 rounded-full bg-green px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              Accept
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => api.decideFeeProposal(orderId, pendingFeeProposal.id, false))}
              className="flex-1 rounded-full bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs font-bold text-ink disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </section>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {order.type === "shopping" && (
        <section className="home-card space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Items</h2>
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm text-ink">
                <span>
                  <span className="block">
                    {item.quantity}× {item.name}
                    {item.unit_price != null && (
                      <span className="text-ink-500"> · Est. {formatUgx(item.unit_price)} each</span>
                    )}
                  </span>
                  {item.note && <span className="block text-xs text-ink-500">{item.note}</span>}
                </span>
                {item.unit_price != null && (
                  <span className="shrink-0 font-semibold">{formatUgx(item.unit_price * item.quantity)}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-[var(--border-faint)] pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{formatUgx(order.final_total ?? order.estimated_total)}</span>
          </div>
        </section>
      )}

      {order.type === "parcel" && (
        <section className="home-card flex justify-between text-sm font-semibold">
          <span>Delivery fee</span>
          <span>{formatUgx(order.final_total ?? order.estimated_total)}</span>
        </section>
      )}

      {awaitingRiderOrPayment && (
        <section className="home-card space-y-3">
          {!order.rider_id && (
            <div className="flex items-center gap-3 py-2">
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              <p className="text-sm text-ink-500">Finding a nearby verified rider…</p>
            </div>
          )}

          {order.rider_id && pendingPayment && (
            <div className="flex items-center gap-3 py-2">
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              <p className="text-sm text-ink-500">
                Confirming your {mobileMoneyNetworkLabel((pendingPayment?.network as MobileMoneyNetwork | undefined) ?? null)} payment…
              </p>
            </div>
          )}

          {order.rider_id && !pendingPayment && (
            <>
              <p className="text-sm text-ink-500">A rider is ready. Pay to send your {order.type === "parcel" ? "parcel" : "list"}.</p>
              {order.payment_rail === "escrow" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    doFund();
                  }}
                  className="space-y-2"
                >
                  <div className="space-y-1">
                    <input
                      required
                      value={msisdn}
                      onChange={(e) => setMsisdn(e.target.value)}
                      placeholder="Mobile money number (e.g. 0772345678)"
                      className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
                    />
                    {detectedNetwork && (
                      <p className="px-1 text-xs font-semibold text-ink-500">
                        {mobileMoneyNetworkLabel(detectedNetwork)} detected
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
                  >
                    Pay via {mobileMoneyNetworkLabel(detectedNetwork)}
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
      )}

      {!awaitingRiderOrPayment && (
      <section className="home-card space-y-3">
        {(order.stage === "Shop" || order.stage === "Substitute") && (
          <>
            <p className="text-sm text-ink-500">
              {order.type === "parcel" ? "Your rider is picking up the parcel." : "Your rider is shopping."}
            </p>
            {pendingGroups.length > 0 && (
              <ul className="space-y-2">
                {pendingGroups.map((group) => {
                  const netDelta = group.subs.reduce((sum, s) => sum + s.price_delta, 0);
                  return (
                    <li key={group.key} className="rounded-xl border border-[var(--border-faint)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                        Your rider proposed a change
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {group.subs.map((sub) => (
                          <li key={sub.id} className="text-sm text-ink">
                            <strong>{sub.original_name}</strong> → <strong>{sub.substitute_name}</strong>
                            {sub.price_delta !== 0 && (
                              <span className="text-ink-500">
                                {" "}
                                ({sub.price_delta > 0 ? "+" : ""}
                                {formatUgx(sub.price_delta)})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {group.subs.length > 1 && (
                        <p className="mt-1.5 text-sm font-semibold text-ink">
                          Net change: {netDelta >= 0 ? "+" : ""}
                          {formatUgx(netDelta)}
                        </p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => run(() => decideGroup(group, true))}
                          className="flex-1 rounded-full bg-green px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => run(() => decideGroup(group, false))}
                          className="flex-1 rounded-full bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs font-bold text-ink disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  );
                })}
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
              Confirm I received my {order.type === "parcel" ? "parcel" : "order"}
            </button>
          </>
        )}

        {order.stage === "Handover" && (
          <p className="text-sm text-ink-500">
            Handover confirmed — thanks! Your rider will close out the order to complete payment.
          </p>
        )}

        {order.stage === "Settle" && (
          <RateDeliveryCard orderId={orderId} rating={detail.rating} onRated={handleRated} />
        )}
      </section>
      )}

      <OrderChat orderId={orderId} />
    </div>
  );
}
