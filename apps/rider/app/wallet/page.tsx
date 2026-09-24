"use client";

import type { OrderRow, SavedMobileNumber, Wallet } from "@tuma/shared";
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
  const [withdrawalNumbers, setWithdrawalNumbers] = useState<SavedMobileNumber[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string | null>(null);
  const polling = useRef(false);

  const [topupMsisdn, setTopupMsisdn] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [pendingTopupId, setPendingTopupId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [walletRes, ordersRes, settingsRes, numbersRes] = await Promise.all([
      api.myWallet(),
      api.myRiderOrders().catch(() => ({ orders: [] as OrderRow[] })),
      api.getSettings().catch(() => null),
      api.getMobileNumbers("withdrawal").catch(() => ({ numbers: [] as SavedMobileNumber[] })),
    ]);
    setWallet(walletRes);
    setOrders(ordersRes.orders.filter((o) => o.stage === "Settle"));
    if (settingsRes) {
      setReserve({
        enabled: settingsRes.settings.riderMinimumBalanceEnabled,
        amount: settingsRes.settings.riderMinimumBalanceAmount,
      });
    }
    setWithdrawalNumbers(numbersRes.numbers);
    setSelectedNumberId((prev) => prev ?? numbersRes.numbers.find((n) => n.is_primary)?.id ?? numbersRes.numbers[0]?.id ?? null);
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

  useEffect(() => {
    if (!pendingTopupId) return;
    const interval = setInterval(() => {
      api
        .refreshRiderTopup(pendingTopupId)
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
    if (!topupMsisdn.trim() || !wallet) return;
    setTopupBusy(true);
    setTopupError(null);
    try {
      const res = await api.topUpRiderWallet({ amount: wallet.depositShortfall, msisdn: topupMsisdn.trim() });
      setPendingTopupId(res.topupId);
    } catch (err) {
      setTopupError(errorMessage(err));
    } finally {
      setTopupBusy(false);
    }
  }

  async function withdraw(amount?: number) {
    setBusy(true);
    setError(null);
    try {
      await api.withdrawWallet(amount, selectedNumberId ?? undefined);
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
  // With 2 saved numbers there's no reasonable default — a choice is
  // mandatory before any withdrawal can go out (see the API's own check in
  // apps/api/src/riders/routes.ts).
  const needsNumberChoice = withdrawalNumbers.length >= 2 && !selectedNumberId;
  const canWithdrawCustom =
    amountInput.trim().length > 0 && parsedAmount > 0 && parsedAmount <= maxWithdrawable && !needsNumberChoice;

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Wallet</h1>

      {wallet && wallet.depositRequired && wallet.depositShortfall > 0 && (
        <section className="home-card space-y-3 !border-l-4 !border-l-red-500">
          <div>
            <p className="text-sm font-bold text-red-600">Top up to keep taking jobs</p>
            <p className="mt-1 text-xs text-ink-500">
              A cash order&apos;s platform fee came out of your required deposit. You&apos;re short{" "}
              {formatUgx(wallet.depositShortfall)} of the {formatUgx(wallet.requiredDeposit)} minimum — top up to
              claim or apply for new jobs again.
            </p>
          </div>
          {pendingTopupId ? (
            <div className="flex items-center gap-3 py-1">
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              <p className="text-sm text-ink-500">Confirming your top-up…</p>
            </div>
          ) : (
            <form onSubmit={submitTopup} className="space-y-2">
              {topupError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{topupError}</p>}
              <input
                required
                value={topupMsisdn}
                onChange={(e) => setTopupMsisdn(e.target.value)}
                placeholder="Mobile money number, e.g. 0772345678"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={topupBusy}
                className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-60"
              >
                {topupBusy ? "Starting…" : `Top up ${formatUgx(wallet.depositShortfall)}`}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="home-card space-y-3 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Wallet balance</p>
          <p className={`text-2xl font-bold ${wallet && wallet.balance < 0 ? "text-red-600" : "text-ink"}`}>
            {wallet ? formatUgx(wallet.balance) : "—"}
          </p>
          <p className="text-xs text-ink-500">Escrow payouts land here — cash jobs pay you directly, on the spot.</p>
          {wallet && wallet.balance < 0 && (
            <p className="mt-1 text-xs text-ink-500">
              A negative balance is a cash-order platform fee — it&apos;ll be covered automatically by your next
              digital job&apos;s payout.
            </p>
          )}
          {reserve.enabled && (
            <p className="mt-1 text-xs text-ink-500">
              A minimum of {formatUgx(reserveAmount)} always stays in your wallet — up to {formatUgx(maxWithdrawable)}{" "}
              is available to withdraw right now.
            </p>
          )}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {withdrawalNumbers.length >= 2 && (
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-ink-500">Withdraw to</label>
            <div className="flex gap-2">
              {withdrawalNumbers.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNumberId(n.id)}
                  disabled={busy || hasPendingWithdrawal}
                  className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50 ${
                    selectedNumberId === n.id ? "border-gold bg-gold/10 text-ink" : "border-[var(--border-faint)] text-ink-500"
                  }`}
                >
                  {n.phone}
                </button>
              ))}
            </div>
          </div>
        )}

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
            disabled={busy || hasPendingWithdrawal || maxWithdrawable <= 0 || needsNumberChoice}
            className="min-h-11 flex-1 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-50"
          >
            {busy ? "Sending…" : "Withdraw all"}
          </button>
        </div>
        {needsNumberChoice && <p className="text-xs text-red-600">Choose which number to withdraw to.</p>}
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
