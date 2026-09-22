/** Canonical order journey stages (UX 2026-09-10). */
export const OrderStage = {
  Create: "Create",
  Match: "Match",
  Fund: "Fund",
  Shop: "Shop",
  Substitute: "Substitute",
  Approve: "Approve",
  Deliver: "Deliver",
  Arrived: "Arrived",
  /** Ride orders only — the passenger's aboard and the rider's now
   * heading to the destination. Goods parcels and shopping orders skip
   * straight from Arrived to Handover. */
  PickedUp: "PickedUp",
  Handover: "Handover",
  Settle: "Settle",
} as const;

export type OrderStage = (typeof OrderStage)[keyof typeof OrderStage];

export const ORDER_STAGES: readonly OrderStage[] = [
  OrderStage.Create,
  OrderStage.Match,
  OrderStage.Fund,
  OrderStage.Shop,
  OrderStage.Substitute,
  OrderStage.Approve,
  OrderStage.Deliver,
  OrderStage.Arrived,
  OrderStage.PickedUp,
  OrderStage.Handover,
  OrderStage.Settle,
] as const;
