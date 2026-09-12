"use client";

import type { Rider } from "@tuma/shared";
import { LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [rider, setRider] = useState<Rider | null>(null);
  const [area, setArea] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [momoMsisdn, setMomoMsisdn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .myRiderProfile()
      .then((res) => {
        setRider(res.rider);
        if (res.rider) {
          setArea(res.rider.area ?? "");
          setVehicleInfo(res.rider.vehicle_info ?? "");
          setMomoMsisdn(res.rider.momo_msisdn ?? "");
        }
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.applyAsRider({
        area: area || undefined,
        vehicleInfo: vehicleInfo || undefined,
        momoMsisdn: momoMsisdn || undefined,
      });
      setRider(res.rider);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Account</h1>

      <section className="home-card flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <User className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <span>
          <span className="block text-[15px] font-bold text-ink">{user?.name ?? "—"}</span>
          <span className="block text-sm text-ink-500">{user?.phone}</span>
        </span>
        {rider && (
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              rider.verified ? "bg-green/15 text-green" : "bg-[#ECE8E2] text-ink-500"
            }`}
          >
            {rider.verified ? "Verified" : "Pending"}
          </span>
        )}
      </section>

      <form onSubmit={onSubmit} className="home-card space-y-3">
        <h2 className="text-sm font-semibold text-ink">Rider profile</h2>
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Area you cover (e.g. Kololo)"
          className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
        />
        <input
          value={vehicleInfo}
          onChange={(e) => setVehicleInfo(e.target.value)}
          placeholder="Vehicle (e.g. Boda — UBG 123X)"
          className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
        />
        <input
          value={momoMsisdn}
          onChange={(e) => setMomoMsisdn(e.target.value)}
          placeholder="MoMo number for payouts"
          className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm font-medium text-green">Saved.</p>}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
        >
          Save profile
        </button>
      </form>

      <button
        onClick={logout}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
        Log out
      </button>
    </div>
  );
}
