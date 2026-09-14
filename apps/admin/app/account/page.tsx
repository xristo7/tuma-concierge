"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

export default function AccountPage() {
  const { user, logout } = useAuth();

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
