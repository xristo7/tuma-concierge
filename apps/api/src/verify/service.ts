import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { generateCode, hashCode } from "./otp.js";
import { isResendConfigured, sendVerificationEmail } from "./email.js";
import { isAfricasTalkingConfigured, sendVerificationSms } from "./sms.js";

const CODE_TTL_MINUTES = 10;

/** Creates a fresh OTP and dispatches it via the configured provider for
 * the channel. Falls back to logging the code when no provider is
 * configured (local dev, or staging before API keys are set) so the flow
 * stays fully testable end-to-end — the caller can surface `devCode` in
 * that case. */
export async function createAndSendOtp(
  userId: string,
  channel: "sms" | "email",
  target: string,
): Promise<{ devCode?: string }> {
  const code = generateCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  await db.execute({
    sql: `INSERT INTO otp_codes (id, user_id, channel, target, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [newId("otp"), userId, channel, target, codeHash, expiresAt],
  });

  if (channel === "email" && isResendConfigured()) {
    await sendVerificationEmail(target, code);
    return {};
  }
  if (channel === "sms" && isAfricasTalkingConfigured()) {
    await sendVerificationSms(target, code);
    return {};
  }

  console.log(`[verify] ${channel} code for ${target}: ${code}`);
  return { devCode: code };
}
