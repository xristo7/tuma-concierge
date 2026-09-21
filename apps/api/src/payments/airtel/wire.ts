/**
 * Airtel Money OpenAPI client — direct integration, no aggregator in
 * between. Collections only (customer -> escrow) for now: Airtel's
 * Disbursements endpoint requires RSA-encrypting a disbursement PIN with a
 * public key Airtel publishes per merchant, which isn't implemented here —
 * same honest gap as ../flutterwave/wire.ts's own disbursement stub, not a
 * shortcut. Only used once its required credentials resolve (admin-entered
 * via ../credentials.ts, or the AIRTEL_* env vars as a fallback) —
 * otherwise ../service.ts routes to ./mock.ts instead.
 *
 * Docs: https://developers.airtel.africa/
 */

import { getCredential, isProviderConfigured } from "../credentials.js";
import type { GatewayChargeInput, GatewayResult, PaymentGatewayAdapter } from "../gateway.js";

async function baseUrl(): Promise<string> {
  const explicit = process.env.AIRTEL_BASE_URL;
  if (explicit) return explicit;
  const targetEnv = (await getCredential("airtel", "targetEnv")) ?? "sandbox";
  return targetEnv === "production" ? "https://openapi.airtel.africa" : "https://openapiuat.airtel.africa";
}

async function country(): Promise<string> {
  return ((await getCredential("airtel", "country")) ?? "UG").toUpperCase();
}

async function clientCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  const clientId = await getCredential("airtel", "clientId");
  const clientSecret = await getCredential("airtel", "clientSecret");
  if (!clientId || !clientSecret) throw new Error("Airtel Money client ID/secret are not set");
  return { clientId, clientSecret };
}

export function isAirtelConfigured(): Promise<boolean> {
  return isProviderConfigured("airtel");
}

type TokenResponse = { access_token: string; token_type: string; expires_in: number };

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = await clientCredentials();
  const res = await fetch(`${await baseUrl()}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    throw new Error(`Airtel Money token request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

async function authHeaders(): Promise<Record<string, string>> {
  const [token, currentCountry] = await Promise.all([getAccessToken(), country()]);
  return {
    Authorization: `Bearer ${token}`,
    "X-Country": currentCountry,
    "X-Currency": "UGX",
    "Content-Type": "application/json",
    Accept: "*/*",
  };
}

type PaymentResponse = {
  status?: { success?: boolean; message?: string; response_code?: string };
  data?: { transaction?: { id?: string; status?: string } };
};

/** Collections — a "push" USSD prompt to the customer's Airtel Money line. */
async function requestToPay(input: GatewayChargeInput): Promise<PaymentResponse> {
  if (!input.msisdn) throw new Error("Airtel Money requires a resolved mobile money number");
  const currentCountry = await country();
  const res = await fetch(`${await baseUrl()}/merchant/v1/payments/`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      reference: input.narrative,
      subscriber: { country: currentCountry, currency: "UGX", msisdn: input.msisdn.replace(/^\+?256/, "") },
      transaction: { amount: input.amount, country: currentCountry, currency: "UGX", id: input.referenceId },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as PaymentResponse;
  if (!res.ok || body.status?.success === false) {
    throw new Error(`Airtel Money requestToPay failed: ${res.status} ${body.status?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

type StatusResponse = { data?: { transaction?: { id?: string; status?: string; message?: string } } };

/** Airtel's own status codes: TS = success, TF = failed, TIP/TA = still in
 * progress/ambiguous — treated as pending rather than guessed either way. */
function mapStatus(raw: string | undefined): GatewayResult["status"] {
  switch (raw) {
    case "TS":
      return "SUCCEEDED";
    case "TF":
      return "FAILED";
    default:
      return "PENDING";
  }
}

export async function checkStatus(transactionReference: string): Promise<GatewayResult> {
  const res = await fetch(`${await baseUrl()}/standard/v1/payments/${encodeURIComponent(transactionReference)}`, {
    headers: await authHeaders(),
  });
  const body = (await res.json().catch(() => ({}))) as StatusResponse;
  if (!res.ok) {
    return { status: "PENDING", transactionReference };
  }
  return {
    status: mapStatus(body.data?.transaction?.status),
    transactionReference,
    providerTransactionId: body.data?.transaction?.id,
    statusMessage: body.data?.transaction?.message,
  };
}

export const airtelAdapter: PaymentGatewayAdapter = {
  key: "airtel",
  displayName: "Airtel Money (direct)",
  isConfigured: isAirtelConfigured,
  // Disbursement needs Airtel's RSA-PIN-encrypted Standard Disbursement
  // API, not implemented yet — collection-only, same shape as Flutterwave.
  supportsDisbursement: false,
  requiresNetwork: false,
  async depositFunds(input): Promise<GatewayResult> {
    await requestToPay(input);
    return { status: "PENDING", transactionReference: input.referenceId };
  },
  async withdrawFunds(): Promise<GatewayResult> {
    throw new Error("Airtel Money disbursement is not implemented — resolveProvider() should never route here");
  },
  checkStatus,
};
