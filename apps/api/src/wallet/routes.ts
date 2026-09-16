import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getWalletSettings } from "../lib/settings.js";
import { checkPaymentStatus, initiateCollection, UnsupportedNetworkError } from "../payments/service.js";
import { appBaseUrl } from "../verify/service.js";
import { creditWallet, getWalletCap } from "./service.js";

export const walletRoutes = new Hono();

type Row = Record<string, unknown>;

/** Balance, cap/verification tier, and recent activity — everything the
 * wallet screen needs in one call. */
walletRoutes.get("/wallet", requireAuth, requireRole("customer"), async (c) => {
  const user = c.get("user");
  const [{ cap, verified }, balanceRes, ledgerRes] = await Promise.all([
    getWalletCap(user.sub),
    db.execute({ sql: "SELECT wallet_balance FROM users WHERE id = ?", args: [user.sub] }),
    db.execute({
      sql: "SELECT * FROM wallet_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      args: [user.sub],
    }),
  ]);
  const balance = Number((balanceRes.rows[0] as Row)?.wallet_balance ?? 0);
  return c.json({ balance, cap, verified, ledger: ledgerRes.rows });
});

const topupSchema = z.object({
  amount: z.number().int().positive(),
  msisdn: z.string().min(6).max(20).optional(),
});

walletRoutes.post("/wallet/topup", requireAuth, requireRole("customer"), async (c) => {
  const user = c.get("user");
  const parsed = topupSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { amount, msisdn } = parsed.data;

  const [{ cap }, settings, balanceRes] = await Promise.all([
    getWalletCap(user.sub),
    getWalletSettings(),
    db.execute({ sql: "SELECT wallet_balance FROM users WHERE id = ?", args: [user.sub] }),
  ]);
  if (amount > settings.maxTopup) {
    return c.json({ error: "topup_too_large", message: `A single top-up can't exceed UGX ${settings.maxTopup.toLocaleString()}` }, 400);
  }
  const balance = Number((balanceRes.rows[0] as Row)?.wallet_balance ?? 0);
  if (balance + amount > cap) {
    return c.json(
      { error: "cap_exceeded", message: `That would put your wallet over its UGX ${cap.toLocaleString()} balance limit` },
      400,
    );
  }

  const topupId = newId("wtu");
  try {
    const initiated = await initiateCollection({
      referenceId: topupId,
      msisdn,
      amount,
      name: user.name,
      returnUrl: `${appBaseUrl("customer")}/wallet?topup_return=${topupId}`,
    });

    await db.execute({
      sql: `INSERT INTO wallet_topups (id, user_id, amount, provider, provider_ref, method, msisdn, network, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        topupId,
        user.sub,
        amount,
        initiated.provider,
        initiated.providerRef,
        initiated.network ? "mobile_money" : "card",
        msisdn ?? null,
        initiated.network,
      ],
    });

    return c.json({ topupId, status: "pending", network: initiated.network, redirectUrl: initiated.redirectUrl }, 201);
  } catch (err) {
    if (err instanceof UnsupportedNetworkError) {
      return c.json({ error: "unsupported_network", message: err.message }, 400);
    }
    console.error("Wallet top-up request failed:", err);
    return c.json({ error: "payment_request_failed", message: "Couldn't start that top-up just now. Please try again." }, 502);
  }
});

walletRoutes.get("/wallet/topups/:id/refresh", requireAuth, requireRole("customer"), async (c) => {
  const id = c.req.param("id") as string;
  const user = c.get("user");
  const res = await db.execute({ sql: "SELECT * FROM wallet_topups WHERE id = ? AND user_id = ?", args: [id, user.sub] });
  const topup = res.rows[0] as Row | undefined;
  if (!topup) return c.json({ error: "not_found" }, 404);
  if (topup.status !== "pending") return c.json({ topup });

  const status = await checkPaymentStatus({
    provider: topup.provider as string,
    provider_ref: topup.provider_ref as string | null,
    created_at: topup.created_at as string,
  });

  if (status === "pending") return c.json({ topup });

  if (status === "failed") {
    await db.execute({
      sql: "UPDATE wallet_topups SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'",
      args: [id],
    });
    return c.json({ topup: { ...topup, status: "failed" } });
  }

  // Race-guarded exactly like payments/routes.ts applyPaymentStatus(): only
  // the request that actually flips pending -> successful gets to credit
  // the wallet, so a poll landing at the same moment as a second poll (or
  // a future webhook) can't double-credit.
  const updated = await db.execute({
    sql: "UPDATE wallet_topups SET status = 'successful', updated_at = datetime('now') WHERE id = ? AND status = 'pending'",
    args: [id],
  });
  if ((updated.rowsAffected ?? 0) > 0) {
    await creditWallet(user.sub, topup.amount as number, { type: "topup", topupId: id, note: "Wallet top-up" });
  }

  return c.json({ topup: { ...topup, status: "successful" } });
});
