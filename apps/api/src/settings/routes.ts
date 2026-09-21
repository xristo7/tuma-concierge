import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { hasPermission, requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { clientIp } from "../lib/ratelimit.js";
import {
  getActiveProviders,
  getDeliverySettings,
  getMatchingSettings,
  getMonetizationSettings,
  getPaymentsDemoMode,
  getVoiceNoteMaxSeconds,
  getWalletSettings,
  setActiveProviders,
  setMatchingModesEnabled,
  setMonetizationSettings,
  setPaymentsDemoMode,
  setSetting,
  type PaymentProviderIdentity,
} from "../lib/settings.js";
import { clearCredential, PROVIDER_CREDENTIAL_FIELDS, saveCredentials } from "../payments/credentials.js";
import { paymentsIntegrationStatus } from "../payments/service.js";

export const settingsRoutes = new Hono();

async function fullSettings() {
  const [delivery, matching, activeProviders, demoMode, wallet, voiceNoteMaxSeconds, monetization] = await Promise.all([
    getDeliverySettings(),
    getMatchingSettings(),
    getActiveProviders(),
    getPaymentsDemoMode(),
    getWalletSettings(),
    getVoiceNoteMaxSeconds(),
    getMonetizationSettings(),
  ]);
  return {
    ...delivery,
    ...matching,
    paymentsActiveProviders: activeProviders,
    paymentsDemoMode: demoMode,
    walletUnverifiedCap: wallet.unverifiedCap,
    walletVerifiedCap: wallet.verifiedCap,
    walletMaxTopup: wallet.maxTopup,
    voiceNoteMaxSeconds,
    ...monetization,
  };
}

/** Any signed-in user: the customer app needs the current rate/range (to show
 * a live estimate) and which matching modes are on offer (to build the
 * preference picker). None of it is sensitive, but it isn't reachable while
 * signed out either — orderRoutes registers requireAuth as "*" on the shared
 * /v1 router, which covers everything mounted after it, this included. */
settingsRoutes.get("/settings", async (c) => {
  return c.json({ settings: await fullSettings() });
});

const updateSchema = z.object({
  deliveryRatePerKm: z.number().positive().max(1_000_000).optional(),
  minimumDeliveryFee: z.number().int().nonnegative().max(1_000_000).optional(),
  serviceRangeKm: z.number().positive().max(1000).optional(),
  shoppingDeliveryFee: z.number().int().nonnegative().max(1_000_000).optional(),
  enabledModes: z.array(z.enum(["first_to_claim", "nearest_window", "customer_selects"])).optional(),
  nearestWindowSeconds: z.number().int().positive().max(3600).optional(),
  maxAssignmentMinutes: z.number().int().positive().max(120).optional(),
  paymentsActiveProviders: z.array(z.enum(["yo", "flutterwave", "mtn", "airtel"])).min(1).max(4).optional(),
  paymentsDemoMode: z.boolean().optional(),
  walletUnverifiedCap: z.number().int().positive().max(100_000_000).optional(),
  walletVerifiedCap: z.number().int().positive().max(100_000_000).optional(),
  walletMaxTopup: z.number().int().positive().max(100_000_000).optional(),
  voiceNoteMaxSeconds: z.number().int().positive().max(600).optional(),
  // Monetization — see ../lib/monetization.ts for how these combine.
  deliveryCommissionEnabled: z.boolean().optional(),
  deliveryCommissionParcelPercent: z.number().min(0).max(100).optional(),
  deliveryCommissionShoppingPercent: z.number().min(0).max(100).optional(),
  serviceFeeEnabled: z.boolean().optional(),
  serviceFeeType: z.enum(["flat", "percent"]).optional(),
  serviceFeeValue: z.number().min(0).max(1_000_000).optional(),
  processingFeeEnabled: z.boolean().optional(),
  processingFeePercent: z.number().min(0).max(100).optional(),
  processingFeeMode: z.enum(["customer", "rider", "split"]).optional(),
  processingFeeSplitCustomerPercent: z.number().min(0).max(100).optional(),
  subscriptionEnabled: z.boolean().optional(),
  subscriptionAmount: z.number().min(0).max(1_000_000).optional(),
  subscriptionCadence: z.enum(["daily", "weekly", "monthly"]).optional(),
});

const PAYMENTS_FIELDS = [
  "paymentsActiveProviders",
  "paymentsDemoMode",
  "walletUnverifiedCap",
  "walletVerifiedCap",
  "walletMaxTopup",
  "deliveryCommissionEnabled",
  "deliveryCommissionParcelPercent",
  "deliveryCommissionShoppingPercent",
  "serviceFeeEnabled",
  "serviceFeeType",
  "serviceFeeValue",
  "processingFeeEnabled",
  "processingFeePercent",
  "processingFeeMode",
  "processingFeeSplitCustomerPercent",
  "subscriptionEnabled",
  "subscriptionAmount",
  "subscriptionCadence",
] as const;

settingsRoutes.put(
  "/admin/settings",
  requireAuth,
  requireRole("admin"),
  requirePermission("settings.manage"),
  async (c) => {
    const user = c.get("user");
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

    // Which payment aggregator moves real money is a bigger blast radius
    // than delivery pricing — require the more specific permission too,
    // rather than letting anyone with generic settings.manage flip it.
    if (PAYMENTS_FIELDS.some((f) => parsed.data[f] != null) && !hasPermission(user.adminRole, "payments.manage")) {
      return c.json({ error: "forbidden", message: "Requires the payments.manage permission" }, 403);
    }

    const before = await fullSettings();

    if (parsed.data.deliveryRatePerKm != null) {
      await setSetting("delivery_rate_per_km", String(parsed.data.deliveryRatePerKm));
    }
    if (parsed.data.minimumDeliveryFee != null) {
      await setSetting("minimum_delivery_fee", String(parsed.data.minimumDeliveryFee));
    }
    if (parsed.data.serviceRangeKm != null) {
      await setSetting("service_range_km", String(parsed.data.serviceRangeKm));
    }
    if (parsed.data.shoppingDeliveryFee != null) {
      await setSetting("shopping_delivery_fee", String(parsed.data.shoppingDeliveryFee));
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
    if (parsed.data.paymentsActiveProviders != null) {
      await setActiveProviders(parsed.data.paymentsActiveProviders as PaymentProviderIdentity[]);
    }
    if (parsed.data.paymentsDemoMode != null) {
      await setPaymentsDemoMode(parsed.data.paymentsDemoMode);
    }
    if (parsed.data.walletUnverifiedCap != null) {
      await setSetting("wallet_unverified_cap", String(parsed.data.walletUnverifiedCap));
    }
    if (parsed.data.walletVerifiedCap != null) {
      await setSetting("wallet_verified_cap", String(parsed.data.walletVerifiedCap));
    }
    if (parsed.data.walletMaxTopup != null) {
      await setSetting("wallet_max_topup", String(parsed.data.walletMaxTopup));
    }
    if (parsed.data.voiceNoteMaxSeconds != null) {
      await setSetting("voice_note_max_seconds", String(parsed.data.voiceNoteMaxSeconds));
    }
    await setMonetizationSettings({
      deliveryCommissionEnabled: parsed.data.deliveryCommissionEnabled,
      deliveryCommissionParcelPercent: parsed.data.deliveryCommissionParcelPercent,
      deliveryCommissionShoppingPercent: parsed.data.deliveryCommissionShoppingPercent,
      serviceFeeEnabled: parsed.data.serviceFeeEnabled,
      serviceFeeType: parsed.data.serviceFeeType,
      serviceFeeValue: parsed.data.serviceFeeValue,
      processingFeeEnabled: parsed.data.processingFeeEnabled,
      processingFeePercent: parsed.data.processingFeePercent,
      processingFeeMode: parsed.data.processingFeeMode,
      processingFeeSplitCustomerPercent: parsed.data.processingFeeSplitCustomerPercent,
      subscriptionEnabled: parsed.data.subscriptionEnabled,
      subscriptionAmount: parsed.data.subscriptionAmount,
      subscriptionCadence: parsed.data.subscriptionCadence,
    });

    const after = await fullSettings();

    await logActivity({
      actor: user,
      action: "settings.update",
      entityType: "settings",
      summary: "Updated platform settings",
      before,
      after,
      revertible: true,
      ip: clientIp(c),
    });

    return c.json({ settings: after });
  },
);

const providerParam = z.enum(["yo", "flutterwave", "mtn", "airtel"]);

const saveCredentialsSchema = z.object({
  fields: z.record(z.string(), z.string().max(2000)),
});

/**
 * Saves API credentials for one payment aggregator. Same gate as the
 * paymentsActiveProviders field above (settings.manage + payments.manage) —
 * this is a strictly more sensitive version of the same action, so it
 * doesn't need its own permission. Values are encrypted before they touch
 * the DB (see ../payments/credentials.ts); the activity log only ever
 * records which field *keys* changed, never their contents.
 */
settingsRoutes.put(
  "/admin/payments/credentials/:provider",
  requireAuth,
  requireRole("admin"),
  requirePermission("settings.manage"),
  requirePermission("payments.manage"),
  async (c) => {
    const user = c.get("user");
    const providerParsed = providerParam.safeParse(c.req.param("provider"));
    if (!providerParsed.success) return c.json({ error: "invalid_provider" }, 400);
    const provider = providerParsed.data as PaymentProviderIdentity;

    const bodyParsed = saveCredentialsSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!bodyParsed.success) return c.json({ error: "invalid_body", issues: bodyParsed.error.issues }, 400);

    const validKeys = new Set(PROVIDER_CREDENTIAL_FIELDS[provider].map((f) => f.key));
    const unknown = Object.keys(bodyParsed.data.fields).filter((k) => !validKeys.has(k));
    if (unknown.length > 0) return c.json({ error: "unknown_field", fields: unknown }, 400);

    const changed = await saveCredentials(provider, bodyParsed.data.fields);

    if (changed.length > 0) {
      await logActivity({
        actor: user,
        action: "payments.credentials.update",
        entityType: "payment_credentials",
        entityId: provider,
        summary: `Updated ${provider} credentials: ${changed.join(", ")}`,
        ip: clientIp(c),
      });
    }

    return c.json({ changed });
  },
);

/** Clears one saved credential field, reverting it to its env-var fallback
 * (if any) — e.g. to roll back to sandbox after testing production keys. */
settingsRoutes.delete(
  "/admin/payments/credentials/:provider/:field",
  requireAuth,
  requireRole("admin"),
  requirePermission("settings.manage"),
  requirePermission("payments.manage"),
  async (c) => {
    const user = c.get("user");
    const providerParsed = providerParam.safeParse(c.req.param("provider"));
    if (!providerParsed.success) return c.json({ error: "invalid_provider" }, 400);
    const provider = providerParsed.data as PaymentProviderIdentity;

    const field = c.req.param("field") ?? "";
    const validKeys = new Set(PROVIDER_CREDENTIAL_FIELDS[provider].map((f) => f.key));
    if (!validKeys.has(field)) return c.json({ error: "unknown_field" }, 400);

    await clearCredential(provider, field);
    await logActivity({
      actor: user,
      action: "payments.credentials.clear",
      entityType: "payment_credentials",
      entityId: provider,
      summary: `Cleared ${provider} credential field: ${field}`,
      ip: clientIp(c),
    });

    return c.json({ ok: true });
  },
);
