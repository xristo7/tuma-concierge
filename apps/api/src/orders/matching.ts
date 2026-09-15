/**
 * Staged radius broadcast for unmatched orders: a freshly-created (or
 * reopened, after a rider cancels) order opens to the nearest riders first
 * — 1km, then 2km, then 3km — then widens to every verified/online rider
 * regardless of distance. That way a rider working alone in a far-away area
 * still eventually sees every order (nobody closer ever showed up), while a
 * nearby rider gets first crack at the ones actually near them. Shared by
 * the customer-triggered auto-match fallback (orders/routes.ts) and the
 * rider-facing job list + claim endpoints (riders/routes.ts) so neither can
 * jump the other's queue.
 */

export const RADIUS_TIERS_KM = [1, 2, 3];
const TIER_WINDOW_SECONDS = 20;

export function parseDbTimestamp(ts: string): Date {
  // SQLite's `datetime('now')` is "YYYY-MM-DD HH:MM:SS" in UTC with no
  // timezone marker — normalize to ISO 8601 so this parses as UTC
  // everywhere, not as local time on non-UTC hosts.
  const iso = /Z|[+-]\d\d:\d\d$/.test(ts) ? ts : `${ts.replace(" ", "T")}Z`;
  return new Date(iso);
}

/** Null means fully open: visible to any eligible rider regardless of distance. */
export function currentVisibilityRadiusKm(becameAvailableAt: string): number | null {
  const elapsedSeconds = (Date.now() - parseDbTimestamp(becameAvailableAt).getTime()) / 1000;
  const tierIndex = Math.floor(elapsedSeconds / TIER_WINDOW_SECONDS);
  return tierIndex >= RADIUS_TIERS_KM.length ? null : RADIUS_TIERS_KM[tierIndex];
}

/** The point a rider's proximity is measured against: pickup for a parcel, destination otherwise. */
export function orderMatchPoint(order: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = (order.type === "parcel" ? order.pickup_lat : order.destination_lat) as number | null;
  const lng = (order.type === "parcel" ? order.pickup_lng : order.destination_lng) as number | null;
  return lat != null && lng != null ? { lat, lng } : null;
}
