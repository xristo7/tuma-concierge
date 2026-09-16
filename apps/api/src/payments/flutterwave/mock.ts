/**
 * Mock Flutterwave simulator — stands in for ./wire.ts whenever
 * FLUTTERWAVE_SECRET_KEY isn't set (the default, same as Yo!'s own mock).
 * Mirrors ../yo/mock.ts's approach: status is derived deterministically
 * from the reference and elapsed time rather than any real network call.
 *
 * One deliberate gap: the real adapter returns a redirectUrl (Flutterwave's
 * hosted checkout page); this mock doesn't, since there's no real page to
 * send anyone to. That means the redirect leg of the flow can only be
 * exercised against real Flutterwave sandbox credentials — everything else
 * (top-up/order-funding request, status polling, ledger crediting) is
 * fully testable through this mock exactly like Yo!'s.
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

export const mockFlutterwaveAdapter: PaymentGatewayAdapter = {
  key: "flutterwave_mock",
  displayName: "Flutterwave (simulated)",
  isConfigured: () => true,
  supportsDisbursement: false,
  requiresNetwork: false,
  async depositFunds(input: GatewayChargeInput): Promise<GatewayResult> {
    return { status: "PENDING", transactionReference: input.referenceId || newId("flwmock") };
  },
  async withdrawFunds(): Promise<GatewayResult> {
    throw new Error("Flutterwave disbursement is not implemented — resolveProvider() should never route here");
  },
  async checkStatus(transactionReference, createdAt): Promise<GatewayResult> {
    return { status: mockStatus(transactionReference, createdAt), transactionReference };
  },
};
