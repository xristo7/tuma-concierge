import type { MatchingMode } from "@tuma/shared";
import { db } from "../db/client.js";

const DEFAULTS = {
  delivery_rate_per_km: "1000",
  service_range_km: "7",
  /** Ceiling on what a single order may charge into escrow (UGX). Guards
   * against a fat-fingered or forged estimate turning into a payment
   * request nobody meant to make. */
  max_order_value: "5000000",
  /** Which rider-matching modes are on offer platform-wide — see
   * ../orders/matching.ts. JSON array of MatchingMode values. A customer's
   * own preference only takes effect if it's in this set; the default
   * keeps today's behavior (first rider to claim wins) until an admin
   * turns anything else on. */
  matching_modes_enabled: '["first_to_claim"]',
  /** How long an order in "nearest_window" mode waits to collect applicants
   * before the app auto-assigns whichever is nearest. */
  nearest_window_seconds: "90",
  /** Safety-net ceiling (for nearest_window and customer_selects) — if
   * nobody's been assigned by this long after the order was created, the
   * app auto-assigns rather than leaving the customer waiting indefinitely. */
  max_assignment_minutes: "5",
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export async function getSetting(key: SettingKey): Promise<string> {
  const res = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return (res.rows[0]?.value as string | undefined) ?? DEFAULTS[key];
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    args: [key, value],
  });
}

export async function getDeliverySettings(): Promise<{ deliveryRatePerKm: number; serviceRangeKm: number }> {
  const [rate, range] = await Promise.all([getSetting("delivery_rate_per_km"), getSetting("service_range_km")]);
  return {
    deliveryRatePerKm: Number(rate) || Number(DEFAULTS.delivery_rate_per_km),
    serviceRangeKm: Number(range) || Number(DEFAULTS.service_range_km),
  };
}

export async function getMaxOrderValue(): Promise<number> {
  return Number(await getSetting("max_order_value")) || Number(DEFAULTS.max_order_value);
}

const ALL_MATCHING_MODES: MatchingMode[] = ["first_to_claim", "nearest_window", "customer_selects"];

function parseEnabledModes(raw: string): MatchingMode[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const modes = Array.isArray(parsed) ? parsed.filter((m): m is MatchingMode => ALL_MATCHING_MODES.includes(m as MatchingMode)) : [];
    return modes.length > 0 ? modes : ["first_to_claim"];
  } catch {
    return ["first_to_claim"];
  }
}

export async function getMatchingSettings(): Promise<{
  enabledModes: MatchingMode[];
  nearestWindowSeconds: number;
  maxAssignmentMinutes: number;
}> {
  const [modesRaw, windowRaw, maxRaw] = await Promise.all([
    getSetting("matching_modes_enabled"),
    getSetting("nearest_window_seconds"),
    getSetting("max_assignment_minutes"),
  ]);
  return {
    enabledModes: parseEnabledModes(modesRaw),
    nearestWindowSeconds: Number(windowRaw) || Number(DEFAULTS.nearest_window_seconds),
    maxAssignmentMinutes: Number(maxRaw) || Number(DEFAULTS.max_assignment_minutes),
  };
}

export async function setMatchingModesEnabled(modes: MatchingMode[]): Promise<void> {
  const valid = modes.filter((m) => ALL_MATCHING_MODES.includes(m));
  await setSetting("matching_modes_enabled", JSON.stringify(valid.length > 0 ? valid : ["first_to_claim"]));
}
