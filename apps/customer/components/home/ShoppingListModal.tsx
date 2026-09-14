"use client";

import type { SavedLocation } from "@tuma/shared";
import { LocateFixed, Map, MapPin, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { api, errorMessage } from "../../lib/api";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";

const LocationMapPicker = dynamic(
  () => import("../LocationMapPicker").then((m) => m.LocationMapPicker),
  { ssr: false },
);

type Item = { name: string; quantity: string; unitCost: string };

function currency(n: number) {
  return `UGX ${n.toLocaleString("en-UG")}`;
}

export function ShoppingListModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"items" | "location">("items");
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: "1", unitCost: "" }]);

  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [manualArea, setManualArea] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "done" | "error">("idle");
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapArea, setMapArea] = useState<string | null>(null);
  const [mapAddress, setMapAddress] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [paymentRail, setPaymentRail] = useState<"escrow" | "float">("escrow");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLocations()
      .then((res) => setLocations(res.locations))
      .catch(() => {});
  }, []);

  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0), 0);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: "", quantity: "1", unitCost: "" }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addItemsFromVoice(extracted: Array<{ name: string; quantity: number }>) {
    const spoken = extracted.map((it) => ({ name: it.name, quantity: String(it.quantity), unitCost: "" }));
    setItems((prev) => {
      const rest = prev.filter((it) => it.name.trim().length > 0);
      return [...rest, ...spoken];
    });
  }

  function goToLocation() {
    const clean = items.filter((it) => it.name.trim().length > 0);
    if (clean.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setError(null);
    setStep("location");
  }

  function useMyLocation() {
    setGeoStatus("locating");
    setSelectedLocationId(null);
    setMapArea(null);
    setMapAddress(null);
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("done");
      },
      () => setGeoStatus("error"),
      { timeout: 10000 },
    );
  }

  async function submit() {
    const selected = locations.find((l) => l.id === selectedLocationId);
    const destinationArea = selected?.area || mapArea || manualArea.trim() || undefined;
    const destinationAddress =
      selected?.address ||
      mapAddress ||
      manualAddress.trim() ||
      (geoCoords ? `Current location (${geoCoords.lat.toFixed(4)}, ${geoCoords.lng.toFixed(4)})` : undefined);

    if (!destinationArea && !destinationAddress) {
      setError("Choose a delivery location.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const cleanItems = items
        .filter((it) => it.name.trim())
        .map((it) => ({
          name: it.name.trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitCost: Number(it.unitCost) || 0,
        }));
      const list = await api.createList({
        items: cleanItems.map((it) => ({ name: it.name, quantity: it.quantity, unitCost: it.unitCost })),
      });
      const { order } = await api.createOrder({
        listId: list.listId,
        type: "shopping",
        destinationArea,
        destinationAddress,
        paymentRail,
        estimatedTotal: total || undefined,
      });
      onClose();
      router.push(`/orders/${order.id}/pay`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={step === "items" ? "Shopping List" : "Delivery location"} onClose={onClose}>
      {step === "items" ? (
        <div className="space-y-4">
          <VoiceNoteRecorder onItemsExtracted={addItemsFromVoice} />

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--border-faint)] bg-white p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ECE8E2] text-xs font-bold text-ink-500">
                  {i + 1}
                </span>
                <input
                  value={item.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  placeholder="Item name"
                  className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none"
                />
                <input
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: e.target.value.replace(/[^\d]/g, "") })}
                  inputMode="numeric"
                  placeholder="Qty"
                  className="w-12 shrink-0 rounded-lg border border-[var(--border-faint)] px-1.5 py-1 text-center text-sm outline-none"
                />
                <input
                  value={item.unitCost}
                  onChange={(e) => updateItem(i, { unitCost: e.target.value.replace(/[^\d]/g, "") })}
                  inputMode="numeric"
                  placeholder="Unit cost"
                  className="w-20 shrink-0 rounded-lg border border-[var(--border-faint)] px-1.5 py-1 text-right text-sm outline-none"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-500/60 hover:text-red-600"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-faint)] py-2.5 text-sm font-semibold text-ink-500"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Add item
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#ECE8E2] px-4 py-3">
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="text-base font-bold text-ink">{currency(total)}</span>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            onClick={goToLocation}
            className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)]"
          >
            Next: delivery location
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {mapAddress || mapArea ? (
            <div className="flex items-start gap-2 rounded-xl border border-gold bg-gold/10 p-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{mapAddress || mapArea}</p>
                <button onClick={() => setShowPicker(true)} className="mt-1 text-xs font-bold text-gold underline">
                  Change pin
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-faint)] py-3 text-sm font-bold text-ink"
            >
              <Map className="h-4 w-4 text-gold" strokeWidth={2.25} aria-hidden />
              Choose on map
            </button>
          )}
          <button
            onClick={useMyLocation}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${
              geoStatus === "done" && !mapAddress && !mapArea
                ? "border-gold bg-gold/10 text-ink"
                : "border-[var(--border-faint)] text-ink"
            }`}
          >
            <LocateFixed className="h-4 w-4 text-gold" strokeWidth={2.25} aria-hidden />
            {geoStatus === "locating"
              ? "Locating…"
              : geoStatus === "done" && !mapAddress && !mapArea
                ? "Using current location"
                : "Use my current location instead"}
          </button>
          {geoStatus === "error" && (
            <p className="text-xs text-red-600">Couldn&apos;t get your location — enable location access or enter an address below.</p>
          )}
          {showPicker && (
            <LocationMapPicker
              initial={geoCoords ?? undefined}
              onCancel={() => setShowPicker(false)}
              onConfirm={(loc) => {
                setGeoCoords({ lat: loc.lat, lng: loc.lng });
                setGeoStatus("done");
                setSelectedLocationId(null);
                setMapArea(loc.area);
                setMapAddress(loc.address);
                setShowPicker(false);
              }}
            />
          )}

          {locations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Saved locations</p>
              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocationId(loc.id);
                      setGeoStatus("idle");
                      setGeoCoords(null);
                      setMapArea(null);
                      setMapAddress(null);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      selectedLocationId === loc.id
                        ? "border-gold bg-gold/10 text-ink"
                        : "border-[var(--border-faint)] text-ink-500"
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Or enter an address</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={manualArea}
                onChange={(e) => {
                  setManualArea(e.target.value);
                  setSelectedLocationId(null);
                  setMapArea(null);
                  setMapAddress(null);
                }}
                placeholder="Area (e.g. Kololo)"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <input
                value={manualAddress}
                onChange={(e) => {
                  setManualAddress(e.target.value);
                  setSelectedLocationId(null);
                  setMapArea(null);
                  setMapAddress(null);
                }}
                placeholder="Address / landmark"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
            </div>
          </div>

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
                  {rail}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setStep("items")}
              className="min-h-12 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink"
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="min-h-12 flex-[2] rounded-full bg-gold px-4 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send list"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
