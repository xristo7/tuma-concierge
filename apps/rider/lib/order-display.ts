import { ORDER_STAGES, type OrderRow, type OrderStageValue } from "@tuma/shared";

export const STAGE_LABELS: Record<OrderStageValue, string> = {
  Create: "New order",
  Match: "Matched",
  Fund: "Awaiting funding",
  Shop: "Shopping",
  Substitute: "Substitution review",
  Approve: "Approved",
  Deliver: "Delivering",
  Handover: "Handover",
  Settle: "Completed",
};

export function stageIndex(stage: string): number {
  const i = ORDER_STAGES.indexOf(stage as OrderStageValue);
  return i === -1 ? 0 : i;
}

export function stageProgressPct(stage: string): number {
  return Math.round(((stageIndex(stage) + 1) / ORDER_STAGES.length) * 100);
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as OrderStageValue] ?? stage;
}

export function formatUgx(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

export function jobTitle(order: OrderRow): string {
  return order.destination_area ? `Delivery to ${order.destination_area}` : `Job #${order.id.slice(-6)}`;
}
