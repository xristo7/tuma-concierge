"use client";

import type { SavedLocation } from "@tuma/shared";
import { LocateFixed, Map, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { api, errorMessage } from "../../lib/api";

type Mode = "text" | "map";

type PointState = {
  mode: Mode;
  area: string;
  address: string;
  selectedLocationId: string | null;
  geoCoords: { lat: number; lng: number } | null;
  geoStatus: "idle" | "locating" | "done" | "error";
};

const emptyPoint: PointState = {
  mode: "text",
  area: "",
  address: "",
  selectedLocationId: null,
  geoCoords: null,
  geoStatus: "idle",
};

function PointEditor({
  point,
  setPoint,
  locations,
}: {
  point: PointState;
  setPoint: (p: PointState) => void;
  locations: SavedLocation[];
}) {
  function useMyLocation() {
    setPoint({ ...point, geoStatus: "locating", selectedLocationId: null });
    if (!navigator.geolocation) {
      setPoint({ ...point, geoStatus: "error" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPoint({
          ...point,
          geoStatus: "done",
          selectedLocationId: null,
          geoCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      () => setPoint({ ...point, geoStatus: "error" }),
      { timeout: 10000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-full bg-[#ECE8E2] p-1">
        <button
          onClick={() => setPoint({ ...point, mode: "text" })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold ${
            point.mode === "text" ? "bg-white text-ink shadow-sm" : "text-ink-500"
          }`}
        >
          <Type className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Text address
        </button>
        <button
          onClick={() => setPoint({ ...point, mode: "map" })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold ${
            point.mode === "map" ? "bg-white text-ink shadow-sm" : "text-ink-500"
          }`}
        >
          <Map className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Map
        </button>
      </div>

      {point.mode === "map" ? (
        <div className="space-y-2 rounded-xl border border-dashed border-[var(--border-faint)] p-4 text-center">
          <p className="text-sm text-ink-500">
            Map picker isn&apos;t set up yet (needs a maps API key) — use your current location or type an address instead.
          </p>
          <button
            onClick={useMyLocation}
            className={`mx-auto flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${
              point.geoStatus === "done" ? "border-gold bg-gold/10 text-ink" : "border-[var(--border-faint)] text-ink"
            }`}
          >
            <LocateFixed className="h-3.5 w-3.5 text-gold" strokeWidth={2.25} aria-hidden />
            {point.geoStatus === "locating"
              ? "Locating…"
              : point.geoStatus === "done"
                ? "Using current location"
                : "Use my current location"}
          </button>
          {point.geoStatus === "error" && <p className="text-xs text-red-600">Couldn&apos;t get your location.</p>}
        </div>
      ) : (
        <>
          {locations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() =>
                    setPoint({ ...point, selectedLocationId: loc.id, geoCoords: null, geoStatus: "idle" })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    point.selectedLocationId === loc.id
                      ? "border-gold bg-gold/10 text-ink"
                      : "border-[var(--border-faint)] text-ink-500"
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          )}
          <input
            value={point.area}
            onChange={(e) => setPoint({ ...point, area: e.target.value, selectedLocationId: null })}
            placeholder="Area (e.g. Kololo)"
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
          <input
            value={point.address}
            onChange={(e) => setPoint({ ...point, address: e.target.value, selectedLocationId: null })}
            placeholder="Address / landmark"
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
        </>
      )}
    </div>
  );
}

function resolvePoint(point: PointState, locations: SavedLocation[]) {
  const selected = locations.find((l) => l.id === point.selectedLocationId);
  const area = selected?.area || point.area.trim() || undefined;
  const address =
    selected?.address ||
    point.address.trim() ||
    (point.geoCoords ? `Current location (${point.geoCoords.lat.toFixed(4)}, ${point.geoCoords.lng.toFixed(4)})` : undefined);
  return { area, address };
}

export function ParcelModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"pickup" | "delivery">("pickup");
  const [pickup, setPickup] = useState<PointState>(emptyPoint);
  const [delivery, setDelivery] = useState<PointState>(emptyPoint);
  const [description, setDescription] = useState("");
  const [estimatedTotal, setEstimatedTotal] = useState("");
  const [paymentRail, setPaymentRail] = useState<"escrow" | "float">("escrow");
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLocations()
      .then((res) => setLocations(res.locations))
      .catch(() => {});
  }, []);

  function next() {
    const p = resolvePoint(pickup, locations);
    if (!p.area && !p.address) {
      setError("Set a pickup location.");
      return;
    }
    setError(null);
    setStep("delivery");
  }

  async function submit() {
    const p = resolvePoint(pickup, locations);
    const d = resolvePoint(delivery, locations);
    if (!d.area && !d.address) {
      setError("Set a delivery location.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await api.createList({ title: description.trim() || "Parcel delivery" });
      const { order } = await api.createOrder({
        listId: list.listId,
        type: "parcel",
        pickupArea: p.area,
        pickupAddress: p.address,
        destinationArea: d.area,
        destinationAddress: d.address,
        paymentRail,
        estimatedTotal: estimatedTotal ? Number(estimatedTotal) : undefined,
      });
      onClose();
      router.push(`/orders/${order.id}/pay`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={step === "pickup" ? "Parcel · Pickup" : "Parcel · Delivery"} onClose={onClose}>
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-ink-500">
        <span className={step === "pickup" ? "text-ink" : ""}>1. Pickup</span>
        <span className="h-px flex-1 bg-[var(--border-faint)]" />
        <span className={step === "delivery" ? "text-ink" : ""}>2. Delivery</span>
      </div>

      {step === "pickup" ? (
        <div className="space-y-4">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the parcel? (optional)"
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
          <PointEditor point={pickup} setPoint={setPickup} locations={locations} />

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            onClick={next}
            className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)]"
          >
            Next: delivery
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <PointEditor point={delivery} setPoint={setDelivery} locations={locations} />

          <input
            value={estimatedTotal}
            onChange={(e) => setEstimatedTotal(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Estimated delivery fee (UGX, optional)"
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />

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
              onClick={() => setStep("pickup")}
              className="min-h-12 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink"
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="min-h-12 flex-[2] rounded-full bg-gold px-4 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send parcel"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
