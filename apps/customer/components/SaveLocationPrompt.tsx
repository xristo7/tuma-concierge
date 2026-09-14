"use client";

import { useState } from "react";
import { LocationPicker, emptyPoint, resolvePoint, type PointState } from "./LocationPicker";
import { Modal } from "./Modal";
import { api, errorMessage } from "../lib/api";

export function SaveLocationPrompt({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState("Home");
  const [point, setPoint] = useState<PointState>(emptyPoint);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const resolved = resolvePoint(point, []);
    if (!resolved.area && !resolved.address) {
      setError("Pin it on the map, or type an address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.saveLocation({
        label: label.trim() || "Home",
        area: resolved.area,
        address: resolved.address,
        lat: resolved.lat,
        lng: resolved.lng,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Save your location" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          Save your home or office so future orders are quick to send — pin it on the map, or type the address.
        </p>

        <div className="flex gap-2">
          {(["Home", "Office"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setLabel(preset)}
              className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold ${
                label === preset ? "border-gold bg-gold/10 text-ink" : "border-[var(--border-faint)] text-ink-500"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name (e.g. Home)"
          className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
        />

        <LocationPicker point={point} setPoint={setPoint} locations={[]} />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-[var(--border-faint)] py-2.5 text-sm font-bold text-ink"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex-[2] rounded-full bg-gold py-2.5 text-sm font-bold text-ink disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save location"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
