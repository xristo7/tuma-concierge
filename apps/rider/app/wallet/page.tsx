"use client";

import type { OrderRow, Wallet } from "@tuma/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { formatUgx } from "../../lib/order-display";

const WITHDRAWAL_STATUS_LABEL: Record<Wallet["withdrawals"][number]["status"], string> = {
  pending: "Processing",
  successful: "Paid out",
  failed: "Failed — refunded",
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [reserve, setReserve] = useState<{ enabled: boolean; amount: number }>({ enabled: false, amount: 0 });
  const [amountInput, setAmountInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);

  const load = useCallback(async () => {
    const [walletRes, ordersRes, settingsRes] = await Promise.all([
      api.myWallet(),
      api.myRiderOrders().catch(() => ({ orders: [] as OrderRow[] })),
      api.getSettings().catch(() => null),
    ]);
    setWallet(walletRes);
    setOrders(ordersRes.orders.filter((o) => o.stage === "Settle"));
    if (settingsRes) {
      setReserve({
        enabled: settingsRes.settings.riderMinimumBalanceEnabled,
        amount: settingsRes.settings.riderMinimumBalanceAmount,
      });
    }
    return walletRes;
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Poll while a withdrawal is still pending — mirrors the customer app's
  // payment-refresh pattern, since sandbox mobile money has no webhook.
  useEffect(() => {
    const pending = wallet?.withdrawals.find((w) => w.status === "pending");
    if (!pending || polling.current) return;
    polling.current = true;
    const interval = setInterval(async () => {
      try {
        await api.refreshWithdrawal(pending.id);
        await load();
      } catch {
        // keep polling — a transient error shouldn't stop it
      }
    }, 4000);
    return () => {
      clearInterval(interval);
      polling.current = false;
    };
  }, [wallet, load]);

  const reserveAmount = reserve.enabled ? reserve.amount : 0;
  const maxWithdrawable = wallet ? Math.max(0, wallet.balance - reserveAmount) : 0;

  async function withdraw(amount?: number) {
    setBusy(true);
    setError(null);
    try {
      await api.withdrawWallet(amount);
      setAmountInput("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const settledTotal = orders.reduce((sum, o) => sum + (o.final_total ?? o.estimated_total ?? 0), 0);
  const hasPendingWithdrawal = !!wallet?.withdrawals.some((w) => w.status === "pending");
  const parsedAmount = Number(amountInput);
  const canWithdrawCustom = amountInput.trim().length > 0 && parsedAmount > 0 && parsedAmount <= maxWithdrawable;

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Wallet</h1>

      <section className="home-card space-y-3 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Wallet balance</p>
          <p className="text-2xl font-bold text-ink">{wallet ? formatUgx(wallet.balance) : "—"}</p>
          <p className="text-xs text-ink-500">Escrow payouts land here — cash jobs pay you directly, on the spot.</p>
          {reserve.enabled && (
            <p className="mt-1 text-xs text-ink-500">
              A minimum of {formatUgx(reserveAmount)} always stays in your wallet — up to {formatUgx(maxWithdrawable)}{" "}
              is available to withdraw right now.
            </p>
          )}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-2 text-left">
          <label className="text-xs font-semibold text-ink-500" htmlFor="withdrawAmount">
            Amount to withdraw (UGX) — leave blank to withdraw the full available amount
          </label>
          <input
            id="withdrawAmount"
            inputMode="numeric"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={maxWithdrawable > 0 ? String(maxWithdrawable) : "0"}
            disabled={busy || hasPendingWithdrawal || maxWithdrawable <= 0}
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold disabled:opacity-50"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => withdraw(parsedAmount)}
            disabled={busy || hasPendingWithdrawal || !canWithdrawCustom}
            className="min-h-11 flex-1 rounded-full border border-gold px-4 text-sm font-bold text-gold disabled:opacity-50"
          >
            {busy ? "Sending…" : "Withdraw amount"}
          </button>
          <button
            onClick={() => withdraw(undefined)}
            disabled={busy || hasPendingWithdrawal || maxWithdrawable <= 0}
            className="min-h-11 flex-1 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-50"
          >
            {busy ? "Sending…" : "Withdraw all"}
          </button>
        </div>
      </section>

      {wallet && wallet.withdrawals.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Withdrawals</h2>
          <ul className="space-y-2">
            {wallet.withdrawals.map((w) => (
              <li key={w.id} className="home-card flex items-center justify-between !rounded-2xl !px-3 !py-3">
                <div>
                  <span className="block text-sm text-ink">{formatUgx(w.amount)}</span>
                  <span className="block text-xs text-ink-500">{new Date(w.created_at).toLocaleDateString()}</span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    w.status === "successful"
                      ? "bg-green/15 text-green"
                      : w.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-[rgb(var(--surface-muted))] text-ink-500"
                  }`}
                >
                  {WITHDRAWAL_STATUS_LABEL[w.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Job history · {formatUgx(settledTotal)} lifetime
        </h2>
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
