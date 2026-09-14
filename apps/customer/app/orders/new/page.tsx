"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "../../../lib/api";

type Item = { name: string; quantity: number; note: string };

export default function NewOrderPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: 1, note: "" }]);
  const [destinationArea, setDestinationArea] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [paymentRail, setPaymentRail] = useState<"escrow" | "float">("escrow");
  const [estimatedTotal, setEstimatedTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { name: "", quantity: 1, note: "" }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanItems = items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name.length > 0);
    if (cleanItems.length === 0) {
      setError("Add at least one item.");
      return;
    }

    setBusy(true);
    try {
      const list = await api.createList({
        title: title.trim() || undefined,
        items: cleanItems.map((it) => ({ name: it.name, quantity: it.quantity, note: it.note || undefined })),
      });
      const { order } = await api.createOrder({
        listId: list.listId,
        destinationArea: destinationArea.trim() || undefined,
        destinationAddress: destinationAddress.trim() || undefined,
        paymentRail,
        estimatedTotal: estimatedTotal ? Number(estimatedTotal) : undefined,
      });
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 px-4 pb-24 pt-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">Step 1 of 3 · Create</p>
        <h1 className="text-xl font-bold text-ink">New list</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-500" htmlFor="title">
            List title (optional)
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekend groceries"
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
        </div>

        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-ink">Items</h2>
          {items.map((item, i) => (
            <div key={i} className="home-card flex items-center gap-2 !rounded-2xl !px-3 !py-2.5">
              <input
                value={item.name}
                onChange={(e) => updateItem(i, { name: e.target.value })}
                placeholder="Item name"
                className="min-w-0 flex-1 border-none bg-transparent text-[15px] outline-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateItem(i, { quantity: Math.max(1, item.quantity - 1) })}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECE8E2] text-ink-500"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateItem(i, { quantity: item.quantity + 1 })}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECE8E2] text-ink-500"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-500/60 hover:text-red-600"
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-faint)] py-2.5 text-sm font-semibold text-ink-500"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add item
          </button>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Delivery</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={destinationArea}
              onChange={(e) => setDestinationArea(e.target.value)}
              placeholder="Area (e.g. Kololo)"
              className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
            />
            <input
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="Address / landmark (optional)"
              className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
            />
          </div>
          <input
            value={estimatedTotal}
            onChange={(e) => setEstimatedTotal(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Estimated total (UGX)"
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">Payment</h2>
          <div className="flex gap-2">
            {(["escrow", "float"] as const).map((rail) => (
              <button
                key={rail}
                type="button"
                onClick={() => setPaymentRail(rail)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize ${
                  paymentRail === rail
                    ? "border-gold bg-gold/10 text-ink"
                    : "border-[var(--border-faint)] text-ink-500"
                }`}
              >
                {rail}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-500">
            {paymentRail === "escrow"
              ? "Funds held in MoMo escrow until you confirm handover."
              : "Rider fronts the cash — settle up with them directly."}
          </p>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-gold px-4 py-3 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity hover:opacity-95 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Continue to payment"}
        </button>
      </form>
    </div>
  );
}
