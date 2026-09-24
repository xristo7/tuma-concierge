/**
 * Multiple named wallets per customer — up to 5 total, counting their
 * original/primary wallet (users.wallet_balance, untouched by this file
 * except for its display name) plus up to 4 real rows in `wallets` (see
 * ../db/migrations/0045_multi_wallet.sql). "primary" is used throughout
 * as the sentinel wallet id for the original wallet, since it isn't a row
 * in `wallets` at all.
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { transferBetweenOwnWallets } from "./service.js";

export const walletsRoutes = new Hono();
walletsRoutes.use("*", requireAuth, requireRole("customer"));

type Row = Record<string, unknown>;

const MAX_WALLETS = 5;
const MAX_SECONDARY_WALLETS = MAX_WALLETS - 1;

/** Client-suggested names, purely a UI convenience — nothing server-side
 * depends on a name matching one of these, a customer can type anything. */
export const SUGGESTED_WALLET_NAMES = [
  "Family Expenses",
  "Office Supplies",
  "Personal Savings",
  "Rent & Bills",
  "Travel Fund",
  "Groceries",
  "Emergency Fund",
  "Kids' Allowance",
  "Business Expenses",
  "Gifts & Events",
];

walletsRoutes.get("/wallets", async (c) => {
  const user = c.get("user");
  const environment = await getPlatformEnvironment();
  const column = environment === "sandbox" ? "wallet_balance_sandbox" : "wallet_balance";
  const walletColumn = environment === "sandbox" ? "balance_sandbox" : "balance";

  const [userRes, walletsRes] = await Promise.all([
    db.execute({ sql: `SELECT ${column} as balance, primary_wallet_name FROM users WHERE id = ?`, args: [user.sub] }),
    db.execute({
      sql: `SELECT id, name, ${walletColumn} as balance, created_at FROM wallets WHERE owner_id = ? ORDER BY created_at ASC`,
      args: [user.sub],
    }),
  ]);
  const userRow = userRes.rows[0] as Row | undefined;

  return c.json({
    wallets: [
      {
        id: "primary",
        name: (userRow?.primary_wallet_name as string | null) ?? "Main Wallet",
        balance: Number(userRow?.balance ?? 0),
        isPrimary: true,
      },
      ...(walletsRes.rows as Row[]).map((w) => ({
        id: w.id as string,
        name: w.name as string,
        balance: Number(w.balance ?? 0),
        isPrimary: false,
      })),
    ],
    suggestedNames: SUGGESTED_WALLET_NAMES,
    maxWallets: MAX_WALLETS,
  });
});

const nameSchema = z.string().trim().min(1).max(40);

walletsRoutes.post("/wallets", async (c) => {
  const user = c.get("user");
  const parsed = z.object({ name: nameSchema }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const count = await db.execute({ sql: "SELECT COUNT(*) as n FROM wallets WHERE owner_id = ?", args: [user.sub] });
  if (Number((count.rows[0] as Row).n) >= MAX_SECONDARY_WALLETS) {
    return c.json({ error: "wallet_limit_reached", message: `You can have up to ${MAX_WALLETS} wallets` }, 409);
  }

  const id = newId("wal");
  await db.execute({
    sql: "INSERT INTO wallets (id, owner_id, name) VALUES (?, ?, ?)",
    args: [id, user.sub, parsed.data.name],
  });
  return c.json({ wallet: { id, name: parsed.data.name, balance: 0, isPrimary: false } }, 201);
});

walletsRoutes.patch("/wallets/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const parsed = z.object({ name: nameSchema }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  if (id === "primary") {
    await db.execute({
      sql: "UPDATE users SET primary_wallet_name = ?, updated_at = datetime('now') WHERE id = ?",
      args: [parsed.data.name, user.sub],
    });
    return c.json({ ok: true });
  }

  const res = await db.execute({
    sql: "UPDATE wallets SET name = ?, updated_at = datetime('now') WHERE id = ? AND owner_id = ?",
    args: [parsed.data.name, id, user.sub],
  });
  if ((res.rowsAffected ?? 0) === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

/** Only a secondary, empty (both live and sandbox balances zero) wallet
 * can be deleted — move any funds out first. Any shares on it are revoked
 * so a grantee doesn't keep pointing at a wallet that no longer exists. */
walletsRoutes.delete("/wallets/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  if (id === "primary") return c.json({ error: "cannot_delete_primary" }, 400);

  const res = await db.execute({ sql: "SELECT * FROM wallets WHERE id = ? AND owner_id = ?", args: [id, user.sub] });
  const wallet = res.rows[0] as Row | undefined;
  if (!wallet) return c.json({ error: "not_found" }, 404);
  if (Number(wallet.balance) !== 0 || Number(wallet.balance_sandbox) !== 0) {
    return c.json({ error: "wallet_not_empty", message: "Move any funds out of this wallet before deleting it" }, 409);
  }

  await db.execute({
    sql: "UPDATE wallet_shares SET status = 'revoked', responded_at = datetime('now') WHERE wallet_id = ? AND status IN ('pending', 'active')",
    args: [id],
  });
  await db.execute({ sql: "DELETE FROM wallets WHERE id = ?", args: [id] });
  return c.json({ ok: true });
});

const walletRefSchema = z.string().min(1); // "primary" or a wallets.id

const transferBetweenSchema = z.object({
  fromWalletId: walletRefSchema,
  toWalletId: walletRefSchema,
  amount: z.number().int().positive(),
});

/** Moving funds between two of your own wallets — distinct from
 * /wallet/transfer, which sends to a *different* customer. */
walletsRoutes.post("/wallets/transfer", async (c) => {
  const user = c.get("user");
  const parsed = transferBetweenSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { fromWalletId, toWalletId, amount } = parsed.data;
  if (fromWalletId === toWalletId) {
    return c.json({ error: "same_wallet", message: "Choose two different wallets" }, 400);
  }

  // Ownership check on any real (non-"primary") wallet id up front, so a
  // bad id fails clearly rather than quietly moving zero rows later.
  for (const walletId of [fromWalletId, toWalletId]) {
    if (walletId === "primary") continue;
    const owned = await db.execute({ sql: "SELECT 1 FROM wallets WHERE id = ? AND owner_id = ?", args: [walletId, user.sub] });
    if (owned.rows.length === 0) return c.json({ error: "not_found", message: "One of those wallets doesn't exist" }, 404);
  }

  const environment = await getPlatformEnvironment();
  const result = await transferBetweenOwnWallets({
    ownerId: user.sub,
    fromWalletId: fromWalletId === "primary" ? undefined : fromWalletId,
    toWalletId: toWalletId === "primary" ? undefined : toWalletId,
    amount,
    environment,
    note: "Between own wallets",
  });
  if (!result) return c.json({ error: "insufficient_balance", message: "Not enough in that wallet" }, 409);

  return c.json({ fromBalance: result.fromBalance, toBalance: result.toBalance });
});

/** A wallet's own activity — same shape as GET /wallet's ledger, just
 * scoped to one wallet instead of always the primary. */
walletsRoutes.get("/wallets/:id/ledger", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const environment = await getPlatformEnvironment();

  if (id !== "primary") {
    const owned = await db.execute({ sql: "SELECT 1 FROM wallets WHERE id = ? AND owner_id = ?", args: [id, user.sub] });
    if (owned.rows.length === 0) return c.json({ error: "not_found" }, 404);
  }

  const res = await db.execute({
    sql: `SELECT wl.*, actor.name as actor_name, cp.name as counterparty_name
          FROM wallet_ledger wl
          LEFT JOIN users actor ON actor.id = wl.actor_id
          LEFT JOIN users cp ON cp.id = wl.counterparty_id
          WHERE wl.user_id = ? AND wl.environment = ? AND wl.wallet_id ${id === "primary" ? "IS NULL" : "= ?"}
          ORDER BY wl.created_at DESC LIMIT 100`,
    args: id === "primary" ? [user.sub, environment] : [user.sub, environment, id],
  });
  return c.json({ ledger: res.rows });
});

const REPORT_PERIODS = ["week", "month", "all"] as const;

/** Simple usage summary for one wallet — totals by ledger entry type over
 * a period, plus the net change, computed straight from wallet_ledger
 * rather than kept as a running counter (this is a read-time aggregate,
 * not something that needs to stay fast at huge scale). */
walletsRoutes.get("/wallets/:id/report", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const periodParsed = z.enum(REPORT_PERIODS).safeParse(c.req.query("period") ?? "month");
  const period = periodParsed.success ? periodParsed.data : "month";
  const environment = await getPlatformEnvironment();

  if (id !== "primary") {
    const owned = await db.execute({ sql: "SELECT 1 FROM wallets WHERE id = ? AND owner_id = ?", args: [id, user.sub] });
    if (owned.rows.length === 0) return c.json({ error: "not_found" }, 404);
  }

  const since =
    period === "week"
      ? "datetime('now', '-7 days')"
      : period === "month"
        ? "datetime('now', '-30 days')"
        : "datetime('now', '-100 years')";

  const res = await db.execute({
    sql: `SELECT type, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
          FROM wallet_ledger
          WHERE user_id = ? AND environment = ? AND wallet_id ${id === "primary" ? "IS NULL" : "= ?"}
                AND created_at >= ${since}
          GROUP BY type`,
    args: id === "primary" ? [user.sub, environment] : [user.sub, environment, id],
  });

  const byType = res.rows as Row[];
  const totalIn = byType.filter((r) => Number(r.total) > 0).reduce((sum, r) => sum + Number(r.total), 0);
  const totalOut = byType.filter((r) => Number(r.total) < 0).reduce((sum, r) => sum + Math.abs(Number(r.total)), 0);

  return c.json({
    period,
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    byType: byType.map((r) => ({ type: r.type, count: Number(r.count), total: Number(r.total) })),
  });
});
