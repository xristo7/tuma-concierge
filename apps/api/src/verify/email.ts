/**
 * Resend — transactional email for onboarding verification codes.
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * Until a custom domain is verified in the Resend dashboard, the sandbox
 * `onboarding@resend.dev` sender can only deliver to the Resend account's
 * own email address — real users' inboxes won't receive anything until a
 * domain is added and RESEND_FROM is set to an address on it.
 */

function apiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return key;
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "Tuma <onboarding@resend.dev>";
}

export function isResendConfigured(): boolean {
  try {
    apiKey();
    return true;
  } catch {
    return false;
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject: "Your Tuma verification code",
      text: `Your Tuma verification code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
