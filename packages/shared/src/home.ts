/** Customer Home stub DTOs — keep in sync with apps/api/src/stubs/home.ts */

export type ListStatus = "DRAFT" | "ACTIVE" | "DELIVERED" | "CANCELLED";

export type HomeListSummary = {
  listId: string;
  title: string;
  status: ListStatus;
  itemCount: number;
  updatedAt: string;
};

export type ActiveOrderSummary = {
  orderId: string;
  listId: string;
  title: string;
  stage: string;
  stageLabel: string;
  progressPct: number;
  etaMinutes: number | null;
  pinHint: string | null;
  riderDisplayName: string | null;
  paymentRail: "escrow" | "float" | null;
};

export type HomePayload = {
  stub: true;
  greetingName: string;
  locationLabel: string;
  activeOrder: ActiveOrderSummary | null;
  recentLists: HomeListSummary[];
};

export type CreateListDraftBody = {
  title?: string;
  items?: Array<{ name: string; quantity?: number; note?: string }>;
};

export type CreateListDraftResponse = {
  stub: true;
  listId: string;
  title: string;
  status: "DRAFT";
  itemCount: number;
  createdAt: string;
  nextPath: string;
};
