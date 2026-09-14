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

/** Where the app's own logo is hosted — email clients load images over
 * plain HTTP(S), not from the local bundle, so this has to be a real URL. */
function logoUrl(): string {
  return process.env.CUSTOMER_APP_URL_LOGO ?? "https://tumaffe.online/brand/tuma-logo-navy.png";
}

export function isResendConfigured(): boolean {
  try {
    apiKey();
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Branded HTML verification email — a card with the logo, a short
 * instruction, a one-tap "Verify Email Address" button (when a link is
 * available) and the 6-digit code as a fallback for typing it in by hand. */
function buildEmailHtml(code: string, verifyLink?: string): string {
  const codeDigits = code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;width:32px;height:40px;line-height:40px;margin:0 3px;font-size:22px;font-weight:700;color:#0A0A0A;background:#F7F3EE;border-radius:8px;">${escapeHtml(d)}</span>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F1EEE8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img src="${logoUrl()}" alt="Tuma" height="28" style="height:28px;width:auto;" />
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF;border-radius:20px;padding:36px 32px;box-shadow:0 4px 16px rgba(10,10,10,0.06);">
                <h1 style="margin:0 0 8px;font-size:20px;color:#0A0A0A;text-align:center;">Verify your email address</h1>
                <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#5C6670;text-align:center;">
                  Tap the button below to confirm it's you and finish setting up your Tuma account.
                </p>
                ${
                  verifyLink
                    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:28px;">
                      <a href="${verifyLink}" style="display:inline-block;background:#C9A227;color:#0A0A0A;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:999px;">Verify Email Address</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 20px;font-size:12px;color:#5C6670;text-align:center;">Or enter this code instead:</p>`
                    : `<p style="margin:0 0 12px;font-size:12px;color:#5C6670;text-align:center;">Enter this code to verify:</p>`
                }
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td align="center">${codeDigits}</td></tr>
                </table>
                <p style="margin:24px 0 0;font-size:12px;color:#5C6670;text-align:center;">This code expires in 10 minutes.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;font-size:12px;line-height:1.6;color:#5C6670;text-align:center;">
                If you didn't request this, you can safely ignore this email.
                <br />© Tuma
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEmailText(code: string, verifyLink?: string): string {
  return verifyLink
    ? `Verify your Tuma account: ${verifyLink}\n\nOr enter this code: ${code}\n\nExpires in 10 minutes. If you didn't request this, ignore this email.`
    : `Your Tuma verification code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`;
}

/** `verifyLink`, when given, is a one-click confirmation URL (email
 * channel, onboarding "verify" purpose only) — clicking it verifies the
 * account with no code entry needed; the code is still shown as a
 * fallback. Password-reset emails omit it and are code-only. */
export async function sendVerificationEmail(to: string, code: string, verifyLink?: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject: verifyLink ? "Verify your Tuma account" : "Your Tuma password reset code",
      html: buildEmailHtml(code, verifyLink),
      text: buildEmailText(code, verifyLink),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
