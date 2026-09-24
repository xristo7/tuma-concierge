"use client";

import { useEffect, useState } from "react";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { api, errorMessage } from "../../../lib/api";

export default function VoiceRecordingsPage() {
  const [voiceNoteMaxSeconds, setVoiceNoteMaxSeconds] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then(({ settings }) => setVoiceNoteMaxSeconds(String(settings.voiceNoteMaxSeconds)))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.adminUpdateSettings({ voiceNoteMaxSeconds: Number(voiceNoteMaxSeconds) });
      setVoiceNoteMaxSeconds(String(res.settings.voiceNoteMaxSeconds));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPageShell title="Voice recordings" loading={loading}>
      <form onSubmit={onSubmit} className="space-y-5">
        <section className="home-card space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-500" htmlFor="voiceMax">
              Max recording length (sec)
            </label>
            <input
              id="voiceMax"
              inputMode="numeric"
              value={voiceNoteMaxSeconds}
              onChange={(e) => setVoiceNoteMaxSeconds(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="60"
              className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
            />
            <p className="text-xs text-ink-500">
              Applies everywhere someone records audio — a shopping list, an order note, a fee-proposal reason, or
              a chat voice message. Recording auto-stops once it hits this length.
            </p>
          </div>
        </section>
        <SettingsSaveBar busy={busy} error={error} saved={saved} />
      </form>
    </SettingsPageShell>
  );
}
