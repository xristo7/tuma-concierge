import { db } from "../db/client.js";

type Row = Record<string, unknown>;

export type MerchantPolicy = {
  settlementReleaseMode: "risk_based_immediate" | "manual_hold";
  unconfirmedReleaseHours: number | null;
  paymentConfirmationMode: "dual_confirm" | "merchant_request" | "rider_only";
  kycGate: "approved_before_receiving" | "provisional_limits" | "before_withdrawal";
  orderBudgetMode: "prefunded_cap" | "approve_each_purchase" | "rider_exception";
  unusedFundsMode: "wallet" | "original_source" | "customer_choice";
  riderUnlockMode: "verified_handover" | "rider_marked" | "dispute_window";
  instantFeeMode: "merchant" | "platform";
  scheduledFeeMode: "merchant" | "platform" | "disabled";
  scheduledCadence: "next_business_day" | "weekly" | "manual";
  merchantCommissionType: "none" | "percent" | "subscription";
  merchantCommissionValue: number;
  rolloutMode: "cohort" | "category" | "open";
  maxOutlets: number | null;
  version: number;
};

function mapPolicy(row: Row): MerchantPolicy {
  return {
    settlementReleaseMode: row.settlement_release_mode as MerchantPolicy["settlementReleaseMode"],
    unconfirmedReleaseHours: row.unconfirmed_release_hours == null ? null : Number(row.unconfirmed_release_hours),
    paymentConfirmationMode: row.payment_confirmation_mode as MerchantPolicy["paymentConfirmationMode"],
    kycGate: row.kyc_gate as MerchantPolicy["kycGate"],
    orderBudgetMode: row.order_budget_mode as MerchantPolicy["orderBudgetMode"],
    unusedFundsMode: row.unused_funds_mode as MerchantPolicy["unusedFundsMode"],
    riderUnlockMode: row.rider_unlock_mode as MerchantPolicy["riderUnlockMode"],
    instantFeeMode: row.instant_fee_mode as MerchantPolicy["instantFeeMode"],
    scheduledFeeMode: row.scheduled_fee_mode as MerchantPolicy["scheduledFeeMode"],
    scheduledCadence: row.scheduled_cadence as MerchantPolicy["scheduledCadence"],
    merchantCommissionType: row.merchant_commission_type as MerchantPolicy["merchantCommissionType"],
    merchantCommissionValue: Number(row.merchant_commission_value) || 0,
    rolloutMode: row.rollout_mode as MerchantPolicy["rolloutMode"],
    maxOutlets: row.max_outlets == null ? null : Number(row.max_outlets),
    version: Number(row.version) || 1,
  };
}

/** Resolves least-specific to most-specific; later rows override earlier
 * ones. Policy rows are complete snapshots, so a transaction can record the
 * selected version and never change meaning after an admin edit. */
export async function resolveMerchantPolicy(merchantId: string, trustTier: string): Promise<MerchantPolicy> {
  const result = await db.execute({
    sql: `SELECT * FROM merchant_policies
          WHERE enabled = 1 AND (
            (scope_type = 'global' AND scope_id = 'global') OR
            (scope_type = 'tier' AND scope_id = ?) OR
            (scope_type = 'merchant' AND scope_id = ?)
          )
          ORDER BY CASE scope_type WHEN 'global' THEN 1 WHEN 'tier' THEN 2 ELSE 3 END`,
    args: [trustTier, merchantId],
  });
  const row = result.rows.at(-1) as Row | undefined;
  if (!row) throw new Error("Global merchant policy is missing");
  return mapPolicy(row);
}
