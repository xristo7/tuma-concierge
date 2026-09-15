import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { getDeliverySettings, getMatchingSettings, setMatchingModesEnabled, setSetting } from "../lib/settings.js";

export const settingsRoutes = new Hono();

async function fullSettings() {
  const [delivery, matching] = await Promise.all([getDeliverySettings(), getMatchingSettings()]);
  return { ...delivery, ...matching };
}

/** Public — the customer app needs the current rate/range (to show a live estimate) and which
 * matching modes are on offer (to build the preference picker). None of this is sensitive. */
settingsRoutes.get("/settings", async (c) => {
  return c.json({ settings: await fullSettings() });
});

const updateSchema = z.object({
  deliveryRatePerKm: z.number().positive().max(1_000_000).optional(),
  serviceRangeKm: z.number().positive().max(1000).optional(),
  enabledModes: z.array(z.enum(["first_to_claim", "nearest_window", "customer_selects"])).optional(),
  nearestWindowSeconds: z.number().int().positive().max(3600).optional(),
  maxAssignmentMinutes: z.number().int().positive().max(120).optional(),
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
  if (parsed.data.enabledModes != null) {
    await setMatchingModesEnabled(parsed.data.enabledModes);
  }
  if (parsed.data.nearestWindowSeconds != null) {
    await setSetting("nearest_window_seconds", String(parsed.data.nearestWindowSeconds));
  }
  if (parsed.data.maxAssignmentMinutes != null) {
    await setSetting("max_assignment_minutes", String(parsed.data.maxAssignmentMinutes));
  }

  return c.json({ settings: await fullSettings() });
});
