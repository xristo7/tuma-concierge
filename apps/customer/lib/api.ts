import { createApiClient } from "@tuma/shared";

export const TOKEN_KEY = "tuma_customer_token";
export const USER_KEY = "tuma_customer_user";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000",
  getToken: getStoredToken,
});

/** Extracts a human-readable message from an ApiClient error. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
