/**
 * Mock Airtel Money (direct) simulator — stands in for ./wire.ts until an
 * admin saves working Airtel credentials. Same deterministic pattern as
 * the other mocks in this folder tree.
 */

import { newId } from "../../lib/ids.js";
import type { GatewayChargeInput, GatewayResult, GatewayStatus, PaymentGatewayAdapter } from "../gateway.js";

const SETTLE_AFTER_MS = 6000;
const SIMULATED_FAILURE_RATE = 0.08;

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mockStatus(transactionReference: string, createdAt: string): GatewayStatus {
  const isoCreatedAt = /Z|[+-]\d\d:\d\d$/.test(createdAt) ? createdAt : `${createdAt.replace(" ", "T")}Z`;
  const elapsed = Date.now() - new Date(isoCreatedAt).getTime();
  if (elapsed < SETTLE_AFTER_MS) return "PENDING";
  const roll = stableHash(transactionReference) % 100;
  return roll < SIMULATED_FAILURE_RATE * 100 ? "FAILED" : "SUCCEEDED";
}

export const mockAirtelAdapter: PaymentGatewayAdapter = {
  key: "airtel_mock",
  displayName: "Airtel Money (simulated)",
  isConfigured: async () => true,
  supportsDisbursement: false,
  requiresNetwork: false,
  async depositFunds(input: GatewayChargeInput): Promise<GatewayResult> {
    return { status: "PENDING", transactionReference: input.referenceId || newId("airtelmock") };
  },
  async withdrawFunds(): Promise<GatewayResult> {
    throw new Error("Airtel Money disbursement is not implemented — resolveProvider() should never route here");
  },
  async checkStatus(transactionReference, createdAt): Promise<GatewayResult> {
    return { status: mockStatus(transactionReference, createdAt), transactionReference };
  },
};
