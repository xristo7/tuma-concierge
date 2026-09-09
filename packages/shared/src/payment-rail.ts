/** Payment rails — diverge at Fund / Settle. */
export const PaymentRail = {
  escrow: "escrow",
  float: "float",
} as const;

export type PaymentRail = (typeof PaymentRail)[keyof typeof PaymentRail];
