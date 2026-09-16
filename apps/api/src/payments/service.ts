/**
 * Mobile money payments — Yo! Payments (Yo Uganda Ltd) aggregates a single
 * integration across MTN MoMo and Airtel Money in Uganda. Live calls are
 * gated behind PAYMENTS_PROVIDER=yo plus YO_API_USERNAME/YO_API_PASSWORD;
 * everything else (including production today) runs against yo/mock.ts,
 * which mirrors the exact same request/response contract, so flipping the
 * switch later needs no caller change — just real credentials.
 */

import { detectMobileMoneyNetwork, mobileMoneyNetworkLabel, type MobileMoneyNetwork } from "@tuma/shared";
import * as yo from "./yo/wire.js";
import * as mock from "./yo/mock.js";

export type PaymentsProvider = "yo" | "yo_mock";

export function activeProvider(): PaymentsProvider {
  return process.env.PAYMENTS_PROVIDER === "yo" && yo.isYoConfigured() ? "yo" : "yo_mock";
}

export function paymentsIntegrationStatus() {
  const provider = activeProvider();
  return {
    provider,
    live: provider === "yo",
    aggregator: "Yo! Payments",
    networks: ["mtn_momo", "airtel_money"],
  };
}

export class UnsupportedNetworkError extends Error {}

function resolveNetwork(msisdn: string): MobileMoneyNetwork {
  const network = detectMobileMoneyNetwork(msisdn);
  if (!network) {
    throw new UnsupportedNetworkError(`${msisdn} isn't a recognized MTN or Airtel Uganda number`);
  }
  return network;
}

type InitiateInput = { referenceId: string; msisdn: string; amount: number; narrative?: string };
type InitiateResult = { providerRef: string; network: MobileMoneyNetwork };

async function initiate(
  input: InitiateInput,
  defaultNarrative: string,
  call: (
    input: { referenceId: string; msisdn: string; network: MobileMoneyNetwork; amount: number; narrative: string },
  ) => Promise<{ transactionReference: string }>,
): Promise<InitiateResult> {
  const network = resolveNetwork(input.msisdn);
  const result = await call({
    referenceId: input.referenceId,
    msisdn: input.msisdn,
    network,
    amount: input.amount,
    narrative: input.narrative ?? defaultNarrative,
  });
  return { providerRef: result.transactionReference, network };
}

/** Collections: pulls funds from the customer's mobile money wallet into escrow. */
export async function initiateCollection(input: InitiateInput): Promise<InitiateResult> {
  return initiate(
    input,
    "Tuma order escrow funding",
    activeProvider() === "yo" ? yo.depositFunds : mock.mockDepositFunds,
  );
}

/** Disbursements: pays a rider out of escrow at Settle. */
export async function initiateDisbursement(input: InitiateInput): Promise<InitiateResult> {
  return initiate(
    input,
    "Tuma rider payout",
    activeProvider() === "yo" ? yo.withdrawFunds : mock.mockWithdrawFunds,
  );
}

export type DbPaymentStatus = "pending" | "successful" | "failed";

function toDbStatus(status: yo.YoTransactionStatus): DbPaymentStatus {
  if (status === "SUCCEEDED") return "successful";
  if (status === "FAILED") return "failed";
  return "pending";
}

export async function checkPaymentStatus(payment: {
  provider: string;
  provider_ref: string | null;
  created_at: string;
}): Promise<DbPaymentStatus> {
  if (!payment.provider_ref) return "pending";
  if (payment.provider === "yo") {
    const result = await yo.checkStatus(payment.provider_ref);
    return toDbStatus(result.status);
  }
  return toDbStatus(mock.mockCheckStatus(payment.provider_ref, payment.created_at));
}

export { mobileMoneyNetworkLabel };
