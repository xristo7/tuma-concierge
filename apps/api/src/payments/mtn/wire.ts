/**
 * MTN MoMo Open API client — direct integration, no aggregator in between.
 * Collections (customer -> escrow) and Disbursements (escrow -> rider).
 * Only used once its required credentials resolve (admin-entered via
 * ../credentials.ts, or the MOMO_* env vars as a fallback) — otherwise
 * ../service.ts routes to ./mock.ts instead.
 *
 * Supersedes the old apps/api/src/momo/client.ts (same API, wired into the
 * env-vars-only settings model that predates ../credentials.ts).
 *
 * Docs: https://momodeveloper.mtn.com/
 */

import { getCredential, isProviderConfigured } from "../credentials.js";
import type { GatewayChargeInput, GatewayResult, PaymentGatewayAdapter } from "../gateway.js";

type Product = "collection" | "disbursement";

export type MomoStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

async function baseUrl(): Promise<string> {
  return process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com";
}

async function targetEnv(): Promise<string> {
  return (await getCredential("mtn", "targetEnv")) ?? "sandbox";
}

async function subscriptionKey(product: Product): Promise<string> {
  const key =
    product === "collection"
      ? await getCredential("mtn", "collectionSubscriptionKey")
      : await getCredential("mtn", "disbursementSubscriptionKey");
  if (!key) throw new Error(`MTN MoMo ${product} subscription key is not set`);
  return key;
}

async function apiUser(): Promise<string> {
  const user = await getCredential("mtn", "apiUser");
  if (!user) throw new Error("MTN MoMo API user is not set");
  return user;
}

async function apiKey(): Promise<string> {
  const key = await getCredential("mtn", "apiKey");
  if (!key) throw new Error("MTN MoMo API key is not set");
  return key;
}

export function isMtnConfigured(): Promise<boolean> {
  return isProviderConfigured("mtn");
}

async function getAccessToken(product: Product): Promise<string> {
  const credentials = btoa(`${await apiUser()}:${await apiKey()}`);
  const res = await fetch(`${await baseUrl()}/${product}/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": await subscriptionKey(product),
    },
  });
  if (!res.ok) {
    throw new Error(`MoMo ${product} token request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Collections: RequestToPay — pulls funds from the customer's MoMo wallet into escrow. */
async function requestToPay(input: GatewayChargeInput): Promise<void> {
  if (!input.msisdn) throw new Error("MTN MoMo requires a resolved mobile money number");
  const token = await getAccessToken("collection");
  const res = await fetch(`${await baseUrl()}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": input.referenceId,
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("collection"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(input.amount),
      currency: input.currency,
      externalId: input.referenceId,
      payer: { partyIdType: "MSISDN", partyId: input.msisdn },
      payerMessage: input.narrative,
      payeeNote: input.narrative,
    }),
  });
  if (res.status !== 202) {
    throw new Error(`MoMo requestToPay failed: ${res.status} ${await res.text()}`);
  }
}

async function getRequestToPayStatus(referenceId: string): Promise<MomoStatus> {
  const token = await getAccessToken("collection");
  const res = await fetch(`${await baseUrl()}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("collection"),
    },
  });
  if (!res.ok) {
    throw new Error(`MoMo requestToPay status failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { status: MomoStatus };
  return data.status;
}

/** Disbursements: Transfer — pays the rider out of escrow at Settle. */
async function transfer(input: GatewayChargeInput): Promise<void> {
  if (!input.msisdn) throw new Error("MTN MoMo requires a resolved mobile money number");
  const token = await getAccessToken("disbursement");
  const res = await fetch(`${await baseUrl()}/disbursement/v1_0/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": input.referenceId,
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("disbursement"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(input.amount),
      currency: input.currency,
      externalId: input.referenceId,
      payee: { partyIdType: "MSISDN", partyId: input.msisdn },
      payerMessage: input.narrative,
      payeeNote: input.narrative,
    }),
  });
  if (res.status !== 202) {
    throw new Error(`MoMo transfer failed: ${res.status} ${await res.text()}`);
  }
}

async function getTransferStatus(referenceId: string): Promise<MomoStatus> {
  const token = await getAccessToken("disbursement");
  const res = await fetch(`${await baseUrl()}/disbursement/v1_0/transfer/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": await targetEnv(),
      "Ocp-Apim-Subscription-Key": await subscriptionKey("disbursement"),
    },
  });
  if (!res.ok) {
    throw new Error(`MoMo transfer status failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { status: MomoStatus };
  return data.status;
}

function mapStatus(status: MomoStatus): GatewayResult["status"] {
  if (status === "SUCCESSFUL") return "SUCCEEDED";
  if (status === "FAILED") return "FAILED";
  return "PENDING";
}

export const mtnAdapter: PaymentGatewayAdapter = {
  key: "mtn",
  displayName: "MTN MoMo (direct)",
  // Both the collections and disbursements subscription keys are required
  // fields (see ../credentials.ts) — MTN approves each product separately,
  // so this only reports "configured" once both are in, which is what
  // lets resolveProvider() safely route a rider payout here too.
  isConfigured: isMtnConfigured,
  supportsDisbursement: true,
  requiresNetwork: false,
  async depositFunds(input): Promise<GatewayResult> {
    await requestToPay(input);
    return { status: "PENDING", transactionReference: input.referenceId };
  },
  async withdrawFunds(input): Promise<GatewayResult> {
    await transfer(input);
    return { status: "PENDING", transactionReference: input.referenceId };
  },
  async checkStatus(transactionReference): Promise<GatewayResult> {
    // Collections and disbursements are different reference spaces on
    // MTN's side, but a given payment row only ever calls the leg it was
    // created for — try collection status first (the common case), fall
    // back to disbursement.
    try {
      const status = await getRequestToPayStatus(transactionReference);
      return { status: mapStatus(status), transactionReference };
    } catch {
      const status = await getTransferStatus(transactionReference);
      return { status: mapStatus(status), transactionReference };
    }
  },
};
