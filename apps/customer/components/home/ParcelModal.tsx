"use client";

import type { SavedLocation } from "@tuma/shared";
import { LocateFixed, Map, MapPin, Route, Type } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { api, errorMessage } from "../../lib/api";

/** Great-circle distance in km — mirrors apps/api/src/lib/geo.ts, used only
 * for the live fee preview here; the backend recomputes it authoritatively. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LocationMapPicker = dynamic(
  () => import("../LocationMapPicker").then((m) => m.LocationMapPicker),
  { ssr: false },
);

type Mode = "text" | "map";

type PointState = {
  mode: Mode;
  area: string;
  address: string;
  selectedLocationId: string | null;
  geoCoords: { lat: number; lng: number } | null;
  geoStatus: "idle" | "locating" | "done" | "error";
  mapArea: string | null;
  mapAddress: string | null;
};

const emptyPoint: PointState = {
  mode: "map",
  area: "",
  address: "",
  selectedLocationId: null,
  geoCoords: null,
  geoStatus: "idle",
  mapArea: null,
  mapAddress: null,
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
  const [showPicker, setShowPicker] = useState(false);

  function useMyLocation() {
    setPoint({ ...point, geoStatus: "locating", selectedLocationId: null, mapArea: null, mapAddress: null });
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
          mapArea: null,
          mapAddress: null,
          geoCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      () => setPoint({ ...point, geoStatus: "error" }),
      { timeout: 10000 },
    );
  }

  const pinnedLabel = point.mapAddress || point.mapArea;

  return (
    <div className="space-y-3">
      <div className="flex rounded-full bg-[#ECE8E2] p-1">
        <button
          onClick={() => setPoint({ ...point, mode: "text" })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold ${
            point.mode === "text" ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"
          }`}
        >
          <Type className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Text address
        </button>
        <button
          onClick={() => setPoint({ ...point, mode: "map" })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold ${
            point.mode === "map" ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"
          }`}
        >
          <Map className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Map
        </button>
      </div>

      {point.mode === "map" ? (
        <div className="space-y-2">
          {pinnedLabel ? (
            <div className="flex items-start gap-2 rounded-xl border border-gold bg-gold/10 p-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{pinnedLabel}</p>
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
            className={`mx-auto flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${
              point.geoStatus === "done" && !pinnedLabel
                ? "border-gold bg-gold/10 text-ink"
                : "border-[var(--border-faint)] text-ink"
            }`}
          >
            <LocateFixed className="h-3.5 w-3.5 text-gold" strokeWidth={2.25} aria-hidden />
            {point.geoStatus === "locating"
              ? "Locating…"
              : point.geoStatus === "done" && !pinnedLabel
                ? "Using current location"
                : "Use my current location instead"}
          </button>
          {point.geoStatus === "error" && <p className="text-xs text-red-600">Couldn&apos;t get your location.</p>}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Add address details <span className="font-normal normal-case text-ink-500/70">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={point.area}
                onChange={(e) => setPoint({ ...point, area: e.target.value })}
                placeholder="Area (e.g. Kololo)"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <input
                value={point.address}
                onChange={(e) => setPoint({ ...point, address: e.target.value })}
                placeholder="Landmark / house detail"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
            </div>
            <p className="text-xs text-ink-500">
              Riders find you faster when you add a landmark or house detail along with your map pin.
            </p>
          </div>

          {showPicker && (
            <LocationMapPicker
              initial={point.geoCoords ?? undefined}
              onCancel={() => setShowPicker(false)}
              onConfirm={(loc) => {
                setPoint({
                  ...point,
                  geoCoords: { lat: loc.lat, lng: loc.lng },
                  geoStatus: "done",
                  selectedLocationId: null,
                  mapArea: loc.area,
                  mapAddress: loc.address,
                });
                setShowPicker(false);
              }}
            />
          )}
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
          <div className="grid grid-cols-2 gap-2">
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
          </div>
        </>
      )}
    </div>
  );
}

function resolvePoint(
  point: PointState,
  locations: SavedLocation[],
): { area?: string; address?: string; lat?: number; lng?: number } {
  const selected = locations.find((l) => l.id === point.selectedLocationId);
  if (selected) return { area: selected.area ?? undefined, address: selected.address ?? undefined };
  if (point.mode === "map") {
    const typedArea = point.area.trim() || undefined;
    const typedAddress = point.address.trim() || undefined;
    if (point.mapArea || point.mapAddress) {
      return {
        area: typedArea ?? point.mapArea ?? undefined,
        address: typedAddress ?? point.mapAddress ?? undefined,
        lat: point.geoCoords?.lat,
        lng: point.geoCoords?.lng,
      };
    }
    if (point.geoCoords) {
      return {
        area: typedArea,
        address: typedAddress ?? `Current location (${point.geoCoords.lat.toFixed(4)}, ${point.geoCoords.lng.toFixed(4)})`,
        lat: point.geoCoords.lat,
        lng: point.geoCoords.lng,
      };
    }
    return { area: typedArea, address: typedAddress };
  }
  return { area: point.area.trim() || undefined, address: point.address.trim() || undefined };
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
  const [ratePerKm, setRatePerKm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLocations()
      .then((res) => setLocations(res.locations))
      .catch(() => {});
    api
      .getSettings()
      .then((res) => setRatePerKm(res.settings.deliveryRatePerKm))
      .catch(() => {});
  }, []);

  const pickupPoint = resolvePoint(pickup, locations);
  const deliveryPoint = resolvePoint(delivery, locations);
  const distanceKm =
    pickupPoint.lat != null && pickupPoint.lng != null && deliveryPoint.lat != null && deliveryPoint.lng != null
      ? haversineKm(pickupPoint.lat, pickupPoint.lng, deliveryPoint.lat, deliveryPoint.lng)
      : null;
  const liveEstimate = distanceKm != null && ratePerKm != null ? Math.round(distanceKm * ratePerKm) : null;

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
        pickupLat: p.lat,
        pickupLng: p.lng,
        destinationArea: d.area,
        destinationAddress: d.address,
        destinationLat: d.lat,
        destinationLng: d.lng,
        paymentRail,
        estimatedTotal: liveEstimate ?? (estimatedTotal ? Number(estimatedTotal) : undefined),
      });
      onClose();
      router.push(`/orders/${order.id}`);
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

          {liveEstimate != null ? (
            <div className="flex items-center gap-2 rounded-xl border border-gold bg-gold/10 p-3">
              <Route className="h-4 w-4 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
              <p className="text-sm text-ink">
                <span className="font-bold">UGX {liveEstimate.toLocaleString("en-UG")}</span> estimated ·{" "}
                {distanceKm!.toFixed(1)} km
              </p>
            </div>
          ) : (
            <input
              value={estimatedTotal}
              onChange={(e) => setEstimatedTotal(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="Estimated delivery fee (UGX, optional)"
              className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
            />
          )}

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
