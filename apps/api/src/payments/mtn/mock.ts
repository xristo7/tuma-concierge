/**
 * Mock MTN MoMo (direct) simulator — stands in for ./wire.ts until an
 * admin saves working MTN credentials. Same deterministic
 * reference-hash-driven settle pattern as ../yo/mock.ts and
 * ../flutterwave/mock.ts.
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

export const mockMtnAdapter: PaymentGatewayAdapter = {
  key: "mtn_mock",
  displayName: "MTN MoMo (simulated)",
  isConfigured: async () => true,
  supportsDisbursement: true,
  requiresNetwork: false,
  async depositFunds(input: GatewayChargeInput): Promise<GatewayResult> {
    return { status: "PENDING", transactionReference: input.referenceId || newId("mtnmock") };
  },
  async withdrawFunds(input: GatewayChargeInput): Promise<GatewayResult> {
    return { status: "PENDING", transactionReference: input.referenceId || newId("mtnmock") };
  },
  async checkStatus(transactionReference, createdAt): Promise<GatewayResult> {
    return { status: mockStatus(transactionReference, createdAt), transactionReference };
  },
};
