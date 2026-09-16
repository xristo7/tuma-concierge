"use client";

import type { CustomerWallet } from "@tuma/shared";
import { detectMobileMoneyNetwork, mobileMoneyNetworkLabel } from "@tuma/shared";
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Wallet as WalletIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useNetworkStatus } from "../../lib/use-network-status";
import { formatDateTime, formatUgx } from "../../lib/order-display";

const LEDGER_ICONS = {
  topup: ArrowDownLeft,
  order_payment: ArrowUpRight,
  refund: RotateCcw,
  adjustment: WalletIcon,
} as const;

const LEDGER_LABELS: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  refund: "Refund",
  adjustment: "Adjustment",
};

export default function WalletPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [amount, setAmount] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTopupId, setPendingTopupId] = useState<string | null>(null);
  const detectedNetwork = useMemo(() => detectMobileMoneyNetwork(msisdn), [msisdn]);
  const online = useNetworkStatus();

  const load = useCallback(() => {
    api
      .getWallet()
      .then(setWallet)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Returning from a hosted checkout (Flutterwave) — resume polling for
  // whichever top-up sent them there.
  useEffect(() => {
    const returned = searchParams.get("topup_return");
    if (returned) {
      setPendingTopupId(returned);
      router.replace("/wallet");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!pendingTopupId) return;
    const interval = setInterval(() => {
      api
        .refreshTopup(pendingTopupId)
        .then((res) => {
          if (res.topup.status !== "pending") {
            setPendingTopupId(null);
            load();
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingTopupId, load]);

  async function submitTopup(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Enter an amount to top up.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.topUpWallet({ amount: parsedAmount, msisdn: msisdn || undefined });
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      setPendingTopupId(res.topupId);
      setAmount("");
      setMsisdn("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) {
    return <div className="p-4 text-sm text-ink-500">Loading wallet…</div>;
  }

  const pctUsed = wallet.cap > 0 ? Math.min(100, Math.round((wallet.balance / wallet.cap) * 100)) : 0;

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Wallet</h1>

      <section className="home-card space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Balance</p>
          <p className="text-3xl font-bold text-ink">{formatUgx(wallet.balance)}</p>
        </div>
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
            <div className="h-full rounded-full bg-gold" style={{ width: `${pctUsed}%` }} />
          </div>
          <p className="text-xs text-ink-500">
            Up to {formatUgx(wallet.cap)} {wallet.verified ? "(verified account)" : "(verify your phone or email to raise this)"}
          </p>
        </div>
      </section>

      <section className="home-card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Top up</h2>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {pendingTopupId ? (
          <div className="flex items-center gap-3 py-2">
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="text-sm text-ink-500">Confirming your top-up…</p>
          </div>
        ) : (
          <form onSubmit={submitTopup} className="space-y-2">
            {!online && (
              <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs font-semibold text-ink-500">
                You&apos;re offline — topping up needs a connection.
              </p>
            )}
            <input
              required
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Amount (UGX)"
              className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
            />
            <div className="space-y-1">
              <input
                required
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                placeholder="Mobile money number (e.g. 0772345678)"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              {detectedNetwork && (
                <p className="px-1 text-xs font-semibold text-ink-500">{mobileMoneyNetworkLabel(detectedNetwork)} detected</p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy || !online}
              className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
            >
              {busy ? "Starting…" : "Top up"}
            </button>
          </form>
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Activity</h2>
        {wallet.ledger.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No wallet activity yet.</p>}
        <ul className="space-y-2">
          {wallet.ledger.map((entry) => {
            const Icon = LEDGER_ICONS[entry.type] ?? WalletIcon;
            const isCredit = entry.amount > 0;
            return (
              <li key={entry.id} className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    isCredit ? "bg-green/15 text-green" : "bg-[rgb(var(--surface-muted))] text-ink-500"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {LEDGER_LABELS[entry.type] ?? entry.type}
                  </span>
                  <span className="block truncate text-xs text-ink-500">{formatDateTime(entry.created_at)}</span>
                </span>
                <span className={`shrink-0 text-sm font-bold ${isCredit ? "text-green" : "text-ink"}`}>
                  {isCredit ? "+" : ""}
                  {formatUgx(entry.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
