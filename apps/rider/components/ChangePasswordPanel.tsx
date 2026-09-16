"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";

/**
 * A Google-only account's password_hash is a random value nobody was ever
 * shown — there's no "current password" for them to enter, so the form
 * would fail every attempt. Point them at "forgot password" instead, which
 * sends an OTP to their verified email and doubles as the way such an
 * account gains a real, known password for the first time.
 */
function NoPasswordSet() {
  return (
    <section className="home-card space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <KeyRound className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-ink">Password</h2>
      </div>
      <p className="text-sm text-ink-500">
        You signed in with Google, so there&apos;s no password on this account yet. Use{" "}
        <Link href="/forgot-password" className="font-semibold text-gold underline">
          forgot password
        </Link>{" "}
        to set one.
      </p>
    </section>
  );
}

export function ChangePasswordPanel() {
  const { user, setSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user?.passwordSet) return <NoPasswordSet />;

  async function onSubmit(e: React.FormEvent) {
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
    <form onSubmit={onSubmit} className="home-card space-y-3">
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
  );
}
