import { db } from "../db/client.js";

const DEFAULTS = {
  delivery_rate_per_km: "1000",
  service_range_km: "7",
  /** Ceiling on what a single order may charge into escrow (UGX). Guards
   * against a fat-fingered or forged estimate turning into a payment
   * request nobody meant to make. */
  max_order_value: "5000000",
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
