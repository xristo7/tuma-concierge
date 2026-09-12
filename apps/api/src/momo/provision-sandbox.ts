/**
 * One-time helper to provision a MoMo *sandbox* API user + API key.
 *
 * Prereqs (do this yourself at https://momodeveloper.mtn.com/ — free, no
 * business registration needed for sandbox):
 *   1. Create a developer account.
 *   2. Subscribe to the "Collections" (and "Disbursements") products.
 *   3. Copy the subscription key(s) into MOMO_SUBSCRIPTION_KEY (or the
 *      product-specific vars) in apps/api/.env.local.
 *
 * Then run:
 *   pnpm --filter api exec tsx src/momo/provision-sandbox.ts
 *
 * It prints MOMO_API_USER and MOMO_API_KEY — put those in your env too.
 * This never touches production and moves no real money.
 */
import { randomUUID } from "node:crypto";

const baseUrl = process.env.MOMO_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com";
const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY;

async function main() {
  if (!subscriptionKey) {
    console.error("Set MOMO_SUBSCRIPTION_KEY first (from the MoMo developer portal).");
    process.exit(1);
  }

  const referenceId = randomUUID();

  const createUserRes = await fetch(`${baseUrl}/v1_0/apiuser`, {
    method: "POST",
    headers: {
      "X-Reference-Id": referenceId,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ providerCallbackHost: process.env.MOMO_CALLBACK_HOST ?? "localhost" }),
  });

  if (createUserRes.status !== 201) {
    console.error(`Failed to create API user: ${createUserRes.status} ${await createUserRes.text()}`);
    process.exit(1);
  }

  const keyRes = await fetch(`${baseUrl}/v1_0/apiuser/${referenceId}/apikey`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": subscriptionKey },
  });

  if (!keyRes.ok) {
    console.error(`Failed to create API key: ${keyRes.status} ${await keyRes.text()}`);
    process.exit(1);
  }

  const { apiKey } = (await keyRes.json()) as { apiKey: string };

  console.log("Sandbox provisioning complete. Add these to apps/api/.env.local:");
  console.log(`MOMO_API_USER=${referenceId}`);
  console.log(`MOMO_API_KEY=${apiKey}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
