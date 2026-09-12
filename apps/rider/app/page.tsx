"use client";

import type { OrderRow, Rider } from "@tuma/shared";
import { ChevronRight, ShieldCheck, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { jobTitle, stageLabel } from "../lib/order-display";

export default function JobsHomePage() {
  const { user } = useAuth();
  const [rider, setRider] = useState<Rider | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api.myRiderProfile(), api.myRiderOrders()])
      .then(([r, o]) => {
        setRider(r.rider);
        setOrders(o.orders);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, [load]);

  async function toggleOnline() {
    if (!rider) return;
    setBusy(true);
    try {
      const res = await api.setRiderOnline(!rider.is_online);
      setRider(res.rider);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const activeOrders = orders.filter((o) => o.stage !== "Settle");

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <header>
        <h1 className="text-xl font-bold text-ink">Hi{user?.name ? `, ${user.name}` : ""}</h1>
      </header>

      {rider && !rider.verified && (
        <div className="home-card flex items-center gap-3 !border-l-4 !border-l-gold">
          <ShieldQuestion className="h-6 w-6 shrink-0 text-gold" strokeWidth={1.75} aria-hidden />
          <p className="text-sm text-ink-500">
            Your account is pending verification. An admin needs to approve you before you can be matched
            with orders.
          </p>
        </div>
      )}

      {rider && (
        <div className="home-card flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            {rider.verified ? (
              <ShieldCheck className="h-5 w-5 text-green" strokeWidth={1.75} aria-hidden />
            ) : (
              <ShieldQuestion className="h-5 w-5 text-ink-500" strokeWidth={1.75} aria-hidden />
            )}
            {rider.verified ? "Verified" : "Unverified"}
          </span>
          <button
            disabled={busy || !rider.verified}
            onClick={toggleOnline}
            className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50 ${
              rider.is_online ? "bg-green text-white" : "bg-[#ECE8E2] text-ink"
            }`}
          >
            {rider.is_online ? "Online" : "Offline"}
          </button>
        </div>
      )}

      {!rider && (
        <div className="home-card space-y-2">
          <p className="text-sm text-ink-500">Set up your rider profile to start receiving orders.</p>
          <Link href="/account" className="text-sm font-bold text-gold">
            Complete profile →
          </Link>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Your jobs</h2>
        {activeOrders.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-500">
            No active jobs. Go online and wait to be matched.
          </p>
        )}
        <ul className="space-y-2.5">
          {activeOrders.map((order) => (
            <li key={order.id}>
              <Link href={`/jobs/${order.id}`} className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{jobTitle(order)}</span>
                  <span className="mt-0.5 block text-xs text-ink-500">{stageLabel(order.stage)}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
