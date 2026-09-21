/**
 * Mock Yo! Payments simulator — stands in for ./wire.ts while
 * PAYMENTS_PROVIDER is unset or not "yo" (the default, including
 * production today). Mirrors the real client's request/response shape so
 * ../service.ts can swap providers later with no caller change, just
 * credentials. No network calls or extra state: status is derived
 * deterministically from the provider reference and elapsed time, so
 * repeated polling (see /v1/payments/:id/refresh) converges the same way a
 * real mobile money PUSH/PULL would — PENDING while "confirming on the
 * phone", then SUCCEEDED (or occasionally FAILED, to keep the demo honest).
 */

import { newId } from "../../lib/ids.js";
import type { GatewayChargeInput, GatewayResult, PaymentGatewayAdapter } from "../gateway.js";
import type { YoDepositWithdrawInput, YoResult, YoTransactionStatus } from "./wire.js";

const SETTLE_AFTER_MS = 6000;
const SIMULATED_FAILURE_RATE = 0.08;

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export async function mockDepositFunds(_input: YoDepositWithdrawInput): Promise<YoResult> {
  return { status: "PENDING", transactionReference: newId("yomock") };
}

export async function mockWithdrawFunds(_input: YoDepositWithdrawInput): Promise<YoResult> {
  return { status: "PENDING", transactionReference: newId("yomock") };
}

export function mockCheckStatus(transactionReference: string, createdAt: string): YoTransactionStatus {
  // createdAt is SQLite's `datetime('now')` — "YYYY-MM-DD HH:MM:SS" in UTC
  // with no timezone marker. Normalize to ISO 8601 so this parses as UTC
  // everywhere, not as local time on non-UTC hosts.
  const isoCreatedAt = /Z|[+-]\d\d:\d\d$/.test(createdAt) ? createdAt : `${createdAt.replace(" ", "T")}Z`;
  const elapsed = Date.now() - new Date(isoCreatedAt).getTime();
  if (elapsed < SETTLE_AFTER_MS) return "PENDING";
  const roll = stableHash(transactionReference) % 100;
  return roll < SIMULATED_FAILURE_RATE * 100 ? "FAILED" : "SUCCEEDED";
}

function toGatewayInput(input: GatewayChargeInput): YoDepositWithdrawInput {
  return {
    referenceId: input.referenceId,
    msisdn: input.msisdn ?? "",
    network: input.network ?? "mtn_momo",
    amount: input.amount,
    narrative: input.narrative,
  };
}

export const mockYoAdapter: PaymentGatewayAdapter = {
  key: "yo_mock",
  displayName: "Yo! Payments (simulated)",
  isConfigured: async () => true,
  supportsDisbursement: true,
  // Matches the real adapter: still worth validating the phone number
  // looks like a real MTN/Airtel Uganda number even in simulation, rather
  // than silently letting a typo through just because nothing's live.
  requiresNetwork: true,
  async depositFunds(input): Promise<GatewayResult> {
    const result = await mockDepositFunds(toGatewayInput(input));
    return { status: result.status, transactionReference: result.transactionReference };
  },
  async withdrawFunds(input): Promise<GatewayResult> {
    const result = await mockWithdrawFunds(toGatewayInput(input));
    return { status: result.status, transactionReference: result.transactionReference };
  },
  async checkStatus(transactionReference, createdAt): Promise<GatewayResult> {
    return { status: mockCheckStatus(transactionReference, createdAt), transactionReference };
  },
};
