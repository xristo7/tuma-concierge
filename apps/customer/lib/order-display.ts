import { ORDER_STAGES, type OrderRow, type OrderStageValue } from "@tuma/shared";

export const STAGE_LABELS: Record<OrderStageValue, string> = {
  Create: "Building order",
  Match: "Finding rider",
  Fund: "Funding",
  Shop: "Shopping",
  Substitute: "Substitution review",
  Approve: "Approved",
  Deliver: "En route",
  Handover: "Handover",
  Settle: "Delivered",
};

export function stageIndex(stage: string): number {
  const i = ORDER_STAGES.indexOf(stage as OrderStageValue);
  return i === -1 ? 0 : i;
}

export function stageProgressPct(stage: string): number {
  return Math.round(((stageIndex(stage) + 1) / ORDER_STAGES.length) * 100);
}

export function stageLabel(stage: string, type?: OrderRow["type"]): string {
  if (type === "parcel" && stage === "Shop") return "Picking up";
  return STAGE_LABELS[stage as OrderStageValue] ?? stage;
}

export function formatUgx(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

export function orderTitle(order: OrderRow): string {
  const noun = order.type === "parcel" ? "Parcel" : "Order";
  return order.destination_area ? `${noun} to ${order.destination_area}` : `${noun} #${order.id.slice(-6)}`;
}
