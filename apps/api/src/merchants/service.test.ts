import assert from "node:assert/strict";
import test from "node:test";
import { assessPurchaseLocation } from "./service.js";

const outlet = { outletLat: 0.347596, outletLng: 32.58252 };

test("accurate GPS inside 50 metres passes", () => {
  const result = assessPurchaseLocation({
    ...outlet,
    riderLat: 0.34761,
    riderLng: 32.58253,
    accuracyM: 12,
    capturedAt: new Date().toISOString(),
    evidenceMode: "gps",
  });
  assert.equal(result.decision, "pass");
  assert.equal(result.reason, "location_verified");
});

test("medium distance requires step-up evidence", () => {
  const result = assessPurchaseLocation({
    ...outlet,
    riderLat: 0.3488,
    riderLng: 32.58252,
    accuracyM: 15,
    capturedAt: new Date().toISOString(),
  });
  assert.equal(result.decision, "step_up");
});

test("merchant re-authentication and receipt satisfy an uncertain reading", () => {
  const result = assessPurchaseLocation({
    ...outlet,
    riderLat: 0.3488,
    riderLng: 32.58252,
    accuracyM: 15,
    capturedAt: new Date().toISOString(),
    evidenceMode: "merchant_reauth_receipt",
    receiptReference: "receipt-1042",
  });
  assert.equal(result.decision, "pass");
  assert.equal(result.reason, "location_step_up_satisfied");
});

test("a clearly remote accurate scan is rejected", () => {
  const result = assessPurchaseLocation({
    ...outlet,
    riderLat: 0.36,
    riderLng: 32.58252,
    accuracyM: 20,
    capturedAt: new Date().toISOString(),
    evidenceMode: "merchant_reauth_receipt",
    receiptReference: "receipt-1043",
  });
  assert.equal(result.decision, "reject");
});

test("missing GPS needs the documented fallback", () => {
  assert.equal(assessPurchaseLocation(outlet).decision, "step_up");
  assert.equal(
    assessPurchaseLocation({
      ...outlet,
      evidenceMode: "merchant_reauth_receipt",
      receiptReference: "receipt-1044",
    }).decision,
    "pass",
  );
});
