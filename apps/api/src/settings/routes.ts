import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { getDeliverySettings, setSetting } from "../lib/settings.js";

export const settingsRoutes = new Hono();

/** Public — the customer app needs the current rate/range to show a live estimate. Neither value is sensitive. */
settingsRoutes.get("/settings", async (c) => {
  return c.json({ settings: await getDeliverySettings() });
});

const updateSchema = z.object({
  deliveryRatePerKm: z.number().positive().max(1_000_000).optional(),
  serviceRangeKm: z.number().positive().max(1000).optional(),
});

settingsRoutes.put("/admin/settings", requireAuth, requireRole("admin"), async (c) => {
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  if (parsed.data.deliveryRatePerKm != null) {
    await setSetting("delivery_rate_per_km", String(parsed.data.deliveryRatePerKm));
  }
  if (parsed.data.serviceRangeKm != null) {
    await setSetting("service_range_km", String(parsed.data.serviceRangeKm));
  }

  return c.json({ settings: await getDeliverySettings() });
});
