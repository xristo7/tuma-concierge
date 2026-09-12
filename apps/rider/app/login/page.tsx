"use client";

import { useState } from "react";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(phone, password);
      } else {
        await register({ phone, name, password });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/tuma-logo-helmet-wordmark.svg" alt="Tuma" className="mx-auto h-9 w-auto" />

        <div className="flex rounded-full bg-[#ECE8E2] p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                mode === m ? "bg-white text-ink shadow-sm" : "text-ink-500"
              }`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 !p-5">
          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-500" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
                placeholder="Juma"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-500" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              placeholder="+256700000002"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-500" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-gold px-4 py-3 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs text-ink-500">
          New riders need admin verification before they can be matched.
          <br />
          Demo rider: +256700000002 / password123 (pre-verified)
        </p>
      </div>
    </div>
  );
}
