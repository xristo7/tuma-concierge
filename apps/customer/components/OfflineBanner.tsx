"use client";

import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "../lib/use-network-status";

/** A plain (non-sticky) block at the top of the page — it just pushes
 * everything else down while it's visible and disappears cleanly when
 * connectivity returns, no z-index/overlap juggling with the header below
 * it. */
export function OfflineBanner() {
  const online = useNetworkStatus();
  if (online) return null;

  return (
    <div
      className="flex items-center justify-center gap-1.5 bg-ink px-3 py-1.5 text-xs font-semibold text-cream"
      style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top))" }}
      role="status"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      You&apos;re offline — showing saved data
    </div>
  );
}
