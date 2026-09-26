import assert from "node:assert/strict";
import test from "node:test";
import { merchantSettlementPostings } from "./reconciliation.js";

test("successful settlement recognizes the fee only after provider success", () => {
  const postings = merchantSettlementPostings({
    success: true,
    merchantId: "merchant-1",
    provider: "yo",
    amount: 40_000,
    fee: 1_000,
    environment: "sandbox",
  });
  assert.equal(postings.reduce((sum, posting) => sum + posting.amount, 0), 0);
  assert.deepEqual(
    postings.map(({ purpose, amount }) => ({ purpose, amount })),
    [
      { purpose: "settlement_in_transit", amount: -41_000 },
      { purpose: "settlement_clearing", amount: 40_000 },
      { purpose: "settlement_fee_revenue", amount: 1_000 },
    ],
  );
});

test("failed settlement restores the full reserved amount", () => {
  const postings = merchantSettlementPostings({
    success: false,
    merchantId: "merchant-1",
    provider: "yo",
    amount: 40_000,
    fee: 1_000,
    environment: "sandbox",
  });
  assert.equal(postings.reduce((sum, posting) => sum + posting.amount, 0), 0);
  assert.deepEqual(
    postings.map(({ purpose, amount }) => ({ purpose, amount })),
    [
      { purpose: "settlement_in_transit", amount: -41_000 },
      { purpose: "payable_available", amount: 41_000 },
    ],
  );
});
