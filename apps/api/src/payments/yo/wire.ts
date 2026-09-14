/**
 * Yo! Payments (Yo Uganda Ltd) API client — a single integration that
 * aggregates both MTN MoMo and Airtel Money in Uganda. Talks to the real
 * Yo! wire format (flat-field XML over HTTP POST). Only used when
 * PAYMENTS_PROVIDER=yo and YO_API_USERNAME/YO_API_PASSWORD are set —
 * otherwise ../service.ts routes to ./mock.ts instead. This code never
 * fabricates credentials and never runs outside the env it's given.
 *
 * Wire format: https://payments.yo.co.ug/resources/API.pdf (v1.4.1)
 */

import { mobileMoneyCurrencyCode, type MobileMoneyNetwork } from "@tuma/shared";

export type YoTransactionStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "INDETERMINATE";

export type YoDepositWithdrawInput = {
  referenceId: string;
  msisdn: string;
  network: MobileMoneyNetwork;
  amount: number;
  narrative: string;
};

export type YoResult = {
  status: YoTransactionStatus;
  transactionReference: string;
  providerTransactionId?: string;
  statusMessage?: string;
};

function baseUrl(): string {
  if (process.env.YO_BASE_URL) return process.env.YO_BASE_URL;
  return (process.env.YO_TARGET_ENV ?? "sandbox") === "production"
    ? "https://paymentsapi1.yo.co.ug/ybs/task.php"
    : "https://sandbox.yo.co.ug/services/yopaymentsdev/task.php";
}

function credentials(): { username: string; password: string } {
  const username = process.env.YO_API_USERNAME;
  const password = process.env.YO_API_PASSWORD;
  if (!username || !password) throw new Error("YO_API_USERNAME/YO_API_PASSWORD are not set");
  return { username, password };
}

export function isYoConfigured(): boolean {
  try {
    credentials();
    return true;
  } catch {
    return false;
  }
}

function escapeXml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildXml(fields: Record<string, string>): string {
  const body = Object.entries(fields)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?><AutoCreate>${body}</AutoCreate>`;
}

function extractTag(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1]?.trim();
}

function mapStatus(raw: string | undefined): YoTransactionStatus {
  switch ((raw ?? "").toUpperCase()) {
    case "SUCCEEDED":
      return "SUCCEEDED";
    case "FAILED":
      return "FAILED";
    case "PENDING":
      return "PENDING";
    default:
      return "INDETERMINATE";
  }
}

function parseResult(xml: string): YoResult {
  return {
    status: mapStatus(extractTag(xml, "TransactionStatus") ?? extractTag(xml, "Status")),
    transactionReference: extractTag(xml, "TransactionReference") ?? "",
    providerTransactionId: extractTag(xml, "MNOTransactionReferenceId"),
    statusMessage: extractTag(xml, "StatusMessage") ?? extractTag(xml, "ErrorMessage"),
  };
}

async function call(fields: Record<string, string>): Promise<string> {
  const { username, password } = credentials();
  const res = await fetch(baseUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/xml", "Content-transfer-encoding": "text" },
    body: buildXml({ APIUsername: username, APIPassword: password, ...fields }),
  });
  if (!res.ok) {
    throw new Error(`Yo! Payments request failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

/** Collections (acdepositfunds) — pulls funds from the customer's mobile money wallet into escrow. */
export async function depositFunds(input: YoDepositWithdrawInput): Promise<YoResult> {
  const xml = await call({
    Method: "acdepositfunds",
    Account: input.msisdn,
    Amount: String(input.amount),
    CurrencyCode: mobileMoneyCurrencyCode(input.network),
    Narrative: input.narrative,
    ExternalReference: input.referenceId,
    NonBlocking: "FALSE",
  });
  return parseResult(xml);
}

/** Disbursements (acwithdrawfunds) — pays a rider out of escrow at Settle. */
export async function withdrawFunds(input: YoDepositWithdrawInput): Promise<YoResult> {
  const xml = await call({
    Method: "acwithdrawfunds",
    Account: input.msisdn,
    Amount: String(input.amount),
    CurrencyCode: mobileMoneyCurrencyCode(input.network),
    Narrative: input.narrative,
    ExternalReference: input.referenceId,
    NonBlocking: "FALSE",
  });
  return parseResult(xml);
}

export async function checkStatus(transactionReference: string): Promise<YoResult> {
  const xml = await call({
    Method: "actransactioncheckstatus",
    TransactionReference: transactionReference,
  });
  return parseResult(xml);
}
