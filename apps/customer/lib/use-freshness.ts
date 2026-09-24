import { useCallback, useEffect, useState } from "react";

/** Renders "3m ago" / "1h ago" — coarse on purpose, this only shows up once
 * data is already stale enough to matter. */
function relativeLabel(fromMs: number): string {
  const seconds = Math.floor((Date.now() - fromMs) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Tracks when a piece of polled data last actually refreshed, and exposes a
 * human label once it's stale enough to matter — for a screen (wallet
 * balance, live order tracking) whose stale-while-revalidate cache can
 * quietly show minutes-old numbers without saying so. Call `markUpdated()`
 * every time a poll succeeds; `label` stays null while data is fresh so
 * nothing shows on the happy path, and only appears past `staleAfterMs`.
 */
export function useFreshness(staleAfterMs = 60_000): {
  markUpdated: () => void;
  isStale: boolean;
  label: string | null;
} {
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [, tick] = useState(0);

  const markUpdated = useCallback(() => setLastUpdatedAt(Date.now()), []);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const isStale = lastUpdatedAt != null && Date.now() - lastUpdatedAt > staleAfterMs;

  return {
    markUpdated,
    isStale,
    label: isStale && lastUpdatedAt != null ? relativeLabel(lastUpdatedAt) : null,
  };
}
