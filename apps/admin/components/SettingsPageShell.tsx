"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function SettingsPageShell({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-500"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </Link>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
      </div>
      {loading ? <p className="text-sm text-ink-500">Loading…</p> : children}
    </div>
  );
}

export function SettingsSaveBar({
  busy,
  error,
  saved,
}: {
  busy: boolean;
  error: string | null;
  saved: boolean;
}) {
  return (
    <>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm font-medium text-green">Saved.</p>}
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </>
  );
}
