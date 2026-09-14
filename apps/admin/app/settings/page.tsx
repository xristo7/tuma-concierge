"use client";

import { Route, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";

export default function SettingsPage() {
  const [deliveryRatePerKm, setDeliveryRatePerKm] = useState("");
  const [serviceRangeKm, setServiceRangeKm] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((res) => {
        setDeliveryRatePerKm(String(res.settings.deliveryRatePerKm));
        setServiceRangeKm(String(res.settings.serviceRangeKm));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.adminUpdateSettings({
        deliveryRatePerKm: Number(deliveryRatePerKm),
        serviceRangeKm: Number(serviceRangeKm),
      });
      setDeliveryRatePerKm(String(res.settings.deliveryRatePerKm));
      setServiceRangeKm(String(res.settings.serviceRangeKm));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Settings</h1>

      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <section className="home-card space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                <SettingsIcon className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="text-sm font-semibold text-ink">Delivery pricing</h2>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-500" htmlFor="rate">
                Rate per km (UGX)
              </label>
              <input
                id="rate"
                inputMode="numeric"
                value={deliveryRatePerKm}
                onChange={(e) => setDeliveryRatePerKm(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="1000"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <p className="text-xs text-ink-500">
                A parcel&apos;s cost is distance (pickup → drop-off) × this rate, calculated automatically when
                both points are pinned on the map.
              </p>
            </div>
          </section>

          <section className="home-card space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Route className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="text-sm font-semibold text-ink">Rider matching</h2>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-500" htmlFor="range">
                Normal service range (km)
              </label>
              <input
                id="range"
                inputMode="numeric"
                value={serviceRangeKm}
                onChange={(e) => setServiceRangeKm(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="7"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
              <p className="text-xs text-ink-500">
                We always match the nearest available rider, even beyond this range if nobody closer is
                online — the customer just gets a heads-up that the rider is out of range and the ride may
                cost a bit more.
              </p>
            </div>
          </section>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {saved && <p className="text-sm font-medium text-green">Saved.</p>}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
}
