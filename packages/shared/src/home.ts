/** Customer Home stub DTOs — keep in sync with apps/api/src/stubs/home.ts */

export type ListStatus = "draft" | "active" | "delivered" | "cancelled";

export type HomeListSummary = {
  id: string;
  listId: string;
  title: string;
  status: ListStatus;
  itemCount: number;
  updatedAt: string;
  updatedLabel: string;
};

export type ActiveOrderSummary = {
  id: string;
  orderId: string;
  listId: string;
  title: string;
  riderName: string | null;
  status: string;
  itemCount: number;
  etaMinutes: number | null;
  destinationArea: string | null;
  pinReady: boolean;
  stage: string;
  stageLabel: string;
  progressPct: number;
  pinHint: string | null;
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
  id: string;
  listId: string;
  title: string;
  status: "draft";
  itemCount: number;
  createdAt: string;
  nextPath: string;
};
