"use client";

import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PasswordInput } from "../../components/PasswordInput";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function AccountPage() {
  const { user, logout, setSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      // The server issues a fresh token for this session and ends every
      // other one — swap it in so this tab keeps working without a re-login.
      setSession(res.token, res.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink">
          <ShieldCheck className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <span>
          <span className="block text-[15px] font-bold text-ink">{user?.name ?? "—"}</span>
          <span className="block text-sm text-ink-500">{user?.phone}</span>
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-semibold text-ink">
          Admin
        </span>
      </section>

      <form onSubmit={onChangePassword} className="home-card space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <KeyRound className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-ink">Change password</h2>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-500" htmlFor="currentPassword">
            Current password
          </label>
          <PasswordInput
            id="currentPassword"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-500" htmlFor="newPassword">
            New password
          </label>
          <PasswordInput
            id="newPassword"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-500" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <PasswordInput
            id="confirmPassword"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm font-medium text-green">Password changed.</p>}

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink disabled:opacity-60"
        >
          {busy ? "Saving…" : "Update password"}
        </button>
        <p className="text-xs text-ink-500">
          Any other device you&apos;re signed in on will be signed out — this one stays signed in.
        </p>
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
