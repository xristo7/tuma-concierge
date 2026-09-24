"use client";

import { MATCHING_MODE_DESCRIPTIONS, MATCHING_MODE_LABELS, type MatchingMode } from "@tuma/shared";
import { useEffect, useState } from "react";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { api, errorMessage } from "../../../lib/api";

const ALL_MODES: MatchingMode[] = ["first_to_claim", "nearest_window", "customer_selects"];

export default function RiderMatchingPage() {
  const [serviceRangeKm, setServiceRangeKm] = useState("");
  const [enabledModes, setEnabledModes] = useState<MatchingMode[]>(["first_to_claim"]);
  const [nearestWindowSeconds, setNearestWindowSeconds] = useState("");
  const [maxAssignmentMinutes, setMaxAssignmentMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then(({ settings }) => {
        setServiceRangeKm(String(settings.serviceRangeKm));
        setEnabledModes(settings.enabledModes);
        setNearestWindowSeconds(String(settings.nearestWindowSeconds));
        setMaxAssignmentMinutes(String(settings.maxAssignmentMinutes));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function toggleMode(mode: MatchingMode) {
    setEnabledModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.adminUpdateSettings({
        serviceRangeKm: Number(serviceRangeKm),
        enabledModes: enabledModes.length > 0 ? enabledModes : ["first_to_claim"],
        nearestWindowSeconds: Number(nearestWindowSeconds),
        maxAssignmentMinutes: Number(maxAssignmentMinutes),
      });
      setServiceRangeKm(String(res.settings.serviceRangeKm));
      setEnabledModes(res.settings.enabledModes);
      setNearestWindowSeconds(String(res.settings.nearestWindowSeconds));
      setMaxAssignmentMinutes(String(res.settings.maxAssignmentMinutes));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPageShell title="Rider matching" loading={loading}>
      <form onSubmit={onSubmit} className="space-y-5">
        <section className="home-card space-y-3">
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
              We always match the nearest available rider, even beyond this range if nobody closer is online — the
              customer just gets a heads-up that the rider is out of range and the ride may cost a bit more.
            </p>
          </div>

          <div className="space-y-2 border-t border-[var(--border-faint)] pt-3">
            <p className="text-xs font-semibold text-ink-500">Matching modes on offer</p>
            {ALL_MODES.map((mode) => (
              <label key={mode} className="flex items-start gap-2.5 rounded-xl border border-[var(--border-faint)] p-2.5">
                <input
                  type="checkbox"
                  checked={enabledModes.includes(mode)}
                  onChange={() => toggleMode(mode)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{MATCHING_MODE_LABELS[mode]}</span>
                  <span className="block text-xs text-ink-500">{MATCHING_MODE_DESCRIPTIONS[mode]}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-ink-500">
              When more than one is enabled, each customer picks their own default in their account settings. With
              just one enabled, every order uses it — no choice shown.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[var(--border-faint)] pt-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-500" htmlFor="window">
                Nearest-window (sec)
              </label>
              <input
                id="window"
                inputMode="numeric"
                value={nearestWindowSeconds}
                onChange={(e) => setNearestWindowSeconds(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="90"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-500" htmlFor="ceiling">
                Max assignment (min)
              </label>
              <input
                id="ceiling"
                inputMode="numeric"
                value={maxAssignmentMinutes}
                onChange={(e) => setMaxAssignmentMinutes(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="5"
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              />
            </div>
            <p className="col-span-2 text-xs text-ink-500">
              &ldquo;Nearest available&rdquo; collects applicants for this long before auto-assigning the closest
              one. &ldquo;Max assignment&rdquo; is the overall safety net — past this, an order gets auto-assigned
              no matter the mode, so nobody waits forever.
            </p>
          </div>
        </section>
        <SettingsSaveBar busy={busy} error={error} saved={saved} />
      </form>
    </SettingsPageShell>
  );
}
