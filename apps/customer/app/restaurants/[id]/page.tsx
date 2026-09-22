"use client";

import type { MenuCategory, MenuItem, MenuItemOption, Restaurant, RestaurantMenu, SavedLocation } from "@tuma/shared";
import { Minus, Plus, ShoppingBag, Store } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LocationPicker, emptyPoint, resolvePoint, type PointState } from "../../../components/LocationPicker";
import { Modal } from "../../../components/Modal";
import { api, errorMessage } from "../../../lib/api";
import { formatUgx } from "../../../lib/order-display";

/** Matches the server's own haversine — see apps/api/src/lib/geo.ts. Used
 * here only for a live estimate before checkout; the actual delivery fee
 * charged is always computed server-side at order creation. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  choiceIds: string[];
};

function ItemDetailModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (line: { unitPrice: number; choiceIds: string[]; choiceNames: string[]; quantity: number }) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  function toggleChoice(option: MenuItemOption, choiceId: string) {
    setSelected((prev) => {
      const current = prev[option.id] ?? [];
      if (option.multi_select) {
        return { ...prev, [option.id]: current.includes(choiceId) ? current.filter((c) => c !== choiceId) : [...current, choiceId] };
      }
      return { ...prev, [option.id]: current.includes(choiceId) ? [] : [choiceId] };
    });
  }

  const missingRequired = item.options.filter((o) => o.required && (selected[o.id] ?? []).length === 0);
  const allChoiceIds = Object.values(selected).flat();
  const allChoices = item.options.flatMap((o) => o.choices).filter((c) => allChoiceIds.includes(c.id));
  const unitPrice = item.price + allChoices.reduce((sum, c) => sum + c.price_delta, 0);

  return (
    <Modal title={item.name} onClose={onClose}>
      <div className="space-y-4 pb-2">
        {item.description && <p className="text-sm text-ink-500">{item.description}</p>}
        <p className="text-lg font-bold text-ink">{formatUgx(item.price)}</p>

        {item.options.map((option) => (
          <div key={option.id} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {option.name}
              {option.required ? " (required)" : " (optional)"}
            </p>
            <div className="space-y-1.5">
              {option.choices.map((choice) => {
                const active = (selected[option.id] ?? []).includes(choice.id);
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => toggleChoice(option, choice.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${
                      active ? "border-gold bg-gold/10 text-ink" : "border-[var(--border-faint)] text-ink-500"
                    }`}
                  >
                    <span>{choice.name}</span>
                    <span>{choice.price_delta > 0 ? `+${formatUgx(choice.price_delta)}` : "—"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between rounded-xl bg-[rgb(var(--surface-muted))] px-3 py-2">
          <span className="text-sm font-semibold text-ink">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--surface-card))] text-ink"
            >
              <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <span className="w-5 text-center text-sm font-bold text-ink">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--surface-card))] text-ink"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={missingRequired.length > 0}
          onClick={() =>
            onAdd({
              unitPrice,
              choiceIds: allChoiceIds,
              choiceNames: allChoices.map((c) => c.name),
              quantity,
            })
          }
          className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
        >
          {missingRequired.length > 0 ? `Choose ${missingRequired[0].name}` : `Add ${quantity} · ${formatUgx(unitPrice * quantity)}`}
        </button>
      </div>
    </Modal>
  );
}

export default function RestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [step, setStep] = useState<"menu" | "checkout">("menu");

  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [delivery, setDelivery] = useState<PointState>(emptyPoint);
  const [paymentRail, setPaymentRail] = useState<"escrow" | "float">("escrow");
  const [busy, setBusy] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<{
    deliveryRatePerKm: number;
    minimumDeliveryFee: number;
    shoppingDeliveryFee: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([api.getRestaurant(id), api.getRestaurantMenu(id)])
      .then(([r, m]) => {
        setRestaurant(r.restaurant);
        setMenu(m);
      })
      .catch((err) => setError(errorMessage(err)));
    api.getLocations().then((res) => setLocations(res.locations)).catch(() => {});
    api
      .getSettings()
      .then((res) =>
        setDeliverySettings({
          deliveryRatePerKm: res.settings.deliveryRatePerKm,
          minimumDeliveryFee: res.settings.minimumDeliveryFee,
          shoppingDeliveryFee: res.settings.shoppingDeliveryFee,
        }),
      )
      .catch(() => {});
  }, [id]);

  function addToCart(item: MenuItem, line: { unitPrice: number; choiceIds: string[]; choiceNames: string[]; quantity: number }) {
    const key = `${item.id}:${[...line.choiceIds].sort().join(",")}`;
    const name = line.choiceNames.length > 0 ? `${item.name} (${line.choiceNames.join(", ")})` : item.name;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + line.quantity } : l));
      }
      return [...prev, { key, menuItemId: item.id, name, unitPrice: line.unitPrice, quantity: line.quantity, choiceIds: line.choiceIds }];
    });
    setActiveItem(null);
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const itemsTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  // Mirrors the server's own formula (apps/api/src/restaurants/customer.ts)
  // so this is a real estimate, not just a placeholder — distance-priced
  // when both the restaurant and the destination have coordinates, else the
  // same flat fee the server falls back to. Only null before settings load.
  const estimatedDeliveryFee = useMemo(() => {
    if (!deliverySettings) return null;
    const resolved = resolvePoint(delivery, locations);
    if (restaurant?.lat != null && restaurant?.lng != null && resolved.lat != null && resolved.lng != null) {
      const km = haversineKm(restaurant.lat, restaurant.lng, resolved.lat, resolved.lng);
      return Math.max(Math.round(km * deliverySettings.deliveryRatePerKm), deliverySettings.minimumDeliveryFee);
    }
    return deliverySettings.shoppingDeliveryFee;
  }, [restaurant, delivery, locations, deliverySettings]);

  async function checkout() {
    const d = resolvePoint(delivery, locations);
    if (!d.area && !d.address) {
      setError("Choose a delivery location.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { order } = await api.orderFromRestaurant(id, {
        items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, choiceIds: l.choiceIds })),
        destinationArea: d.area,
        destinationAddress: d.address,
        destinationLat: d.lat,
        destinationLng: d.lng,
        paymentRail,
      });
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (error && !restaurant) {
    return <p className="px-4 py-10 text-center text-sm text-red-700">{error}</p>;
  }
  if (!restaurant || !menu) {
    return <p className="px-4 py-10 text-center text-sm text-ink-500">Loading…</p>;
  }

  if (step === "checkout") {
    return (
      <div className="space-y-5 px-4 pb-28 pt-4">
        <h1 className="text-xl font-bold text-ink">Delivery details</h1>

        <LocationPicker point={delivery} setPoint={setDelivery} locations={locations} />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Payment</p>
          <div className="flex gap-2">
            {(["escrow", "float"] as const).map((rail) => (
              <button
                key={rail}
                onClick={() => setPaymentRail(rail)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize ${
                  paymentRail === rail ? "border-gold bg-gold/10 text-ink" : "border-[var(--border-faint)] text-ink-500"
                }`}
              >
                {rail === "float" ? "Cash" : "Escrow"}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-500">
            {paymentRail === "float" ? "You pay the rider directly, in person." : "You pay upfront — held safely until delivery is confirmed."}
          </p>
        </div>

        <div className="space-y-1.5 rounded-xl bg-[rgb(var(--surface-muted))] px-4 py-3">
          <div className="flex items-center justify-between text-sm text-ink-500">
            <span>Items total</span>
            <span>{formatUgx(itemsTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-ink-500">
            <span>Delivery fee</span>
            <span>{estimatedDeliveryFee != null ? `~${formatUgx(estimatedDeliveryFee)}` : "Loading…"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-1.5 text-sm font-bold text-ink">
            <span>Estimated total</span>
            <span>{formatUgx(itemsTotal + (estimatedDeliveryFee ?? 0))}</span>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => setStep("menu")}
            className="min-h-12 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink"
          >
            Back to menu
          </button>
          <button
            onClick={checkout}
            disabled={busy}
            className="min-h-12 flex-[2] rounded-full bg-gold px-4 text-base font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
          >
            {busy ? "Placing order…" : "Place order"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-28 pt-4">
      <section className="home-card flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <Store className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-ink">{restaurant.name}</span>
          {(restaurant.cuisine || restaurant.description) && (
            <span className="block text-sm text-ink-500">{restaurant.cuisine ?? restaurant.description}</span>
          )}
        </span>
        {!restaurant.is_open && (
          <span className="shrink-0 rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-xs font-semibold text-ink-500">
            Closed
          </span>
        )}
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {menu.categories.map((cat: MenuCategory) => (
        <section key={cat.id} className="space-y-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{cat.name}</h2>
          <ul className="space-y-2">
            {cat.items.map((item: MenuItem) => (
              <li key={item.id}>
                <button
                  onClick={() => (item.options.length > 0 ? setActiveItem(item) : addToCart(item, { unitPrice: item.price, choiceIds: [], choiceNames: [], quantity: 1 }))}
                  className="home-card flex w-full items-center gap-3 !rounded-2xl !px-3 !py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{item.name}</span>
                    {item.description && <span className="mt-0.5 block truncate text-xs text-ink-500">{item.description}</span>}
                    <span className="mt-0.5 block text-sm font-semibold text-ink">{formatUgx(item.price)}</span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                    <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {menu.uncategorizedItems.length > 0 && (
        <section className="space-y-2.5">
          <ul className="space-y-2">
            {menu.uncategorizedItems.map((item: MenuItem) => (
              <li key={item.id}>
                <button
                  onClick={() => (item.options.length > 0 ? setActiveItem(item) : addToCart(item, { unitPrice: item.price, choiceIds: [], choiceNames: [], quantity: 1 }))}
                  className="home-card flex w-full items-center gap-3 !rounded-2xl !px-3 !py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{item.name}</span>
                    <span className="mt-0.5 block text-sm font-semibold text-ink">{formatUgx(item.price)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {menu.categories.length === 0 && menu.uncategorizedItems.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-500">This restaurant hasn&apos;t added any menu items yet.</p>
      )}

      {activeItem && (
        <ItemDetailModal item={activeItem} onClose={() => setActiveItem(null)} onAdd={(line) => addToCart(activeItem, line)} />
      )}

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-40 px-4 pb-3">
          <button
            onClick={() => setStep("checkout")}
            className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-between rounded-full bg-gold px-5 text-sm font-bold text-ink-gold shadow-[0_4px_16px_rgba(201,162,39,0.4)]"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </span>
            <span>{formatUgx(itemsTotal)}</span>
          </button>
        </div>
      )}

      {cart.length > 0 && step === "menu" && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Your cart</h2>
          <ul className="space-y-2">
            {cart.map((l) => (
              <li key={l.key} className="home-card flex items-center justify-between !rounded-2xl !px-3 !py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {l.quantity}× {l.name}
                  </span>
                  <span className="block text-xs text-ink-500">{formatUgx(l.unitPrice * l.quantity)}</span>
                </span>
                <button onClick={() => removeLine(l.key)} className="shrink-0 text-xs font-semibold text-red-500">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
