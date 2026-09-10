/** In-memory Home stubs for customer click-throughs. Not persisted; no MoMo/escrow. */

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
  /** UX canonical stage (Create…Settle). */
  stage: string;
  stageLabel: string;
  progressPct: number;
  etaMinutes: number | null;
  /** Never return raw PIN in production; stub shows masked. */
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

const nowIso = () => new Date().toISOString();

/** Seed matches Sharon Home mock (FE PR #4). */
let recentLists: HomeListSummary[] = [
  {
    listId: "list_weekend",
    title: "Weekend groceries",
    status: "DRAFT",
    itemCount: 8,
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    listId: "list_office",
    title: "Office snacks",
    status: "DELIVERED",
    itemCount: 5,
    updatedAt: "2026-09-08T14:30:00.000Z",
  },
];

let activeOrder: ActiveOrderSummary | null = {
  orderId: "ord_demo",
  listId: "list_active",
  title: "Nakasero market run",
  stage: "Deliver",
  stageLabel: "En route",
  progressPct: 75,
  etaMinutes: 12,
  pinHint: "••42",
  riderDisplayName: "Juma",
  paymentRail: "escrow",
};

export function getHome(): HomePayload {
  return {
    stub: true,
    greetingName: "Sharon",
    locationLabel: "Kampala · within 5 km",
    activeOrder,
    recentLists: [...recentLists].sort((a, b) =>
      a.updatedAt < b.updatedAt ? 1 : -1,
    ),
  };
}

export function getActiveOrder(): { stub: true; activeOrder: ActiveOrderSummary | null } {
  return { stub: true, activeOrder };
}

export function getRecentLists(limit = 10): {
  stub: true;
  lists: HomeListSummary[];
} {
  return {
    stub: true,
    lists: [...recentLists]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, Math.max(1, Math.min(limit, 50))),
  };
}

export function createListDraft(body: CreateListDraftBody): CreateListDraftResponse {
  const createdAt = nowIso();
  const listId = `list_${Math.random().toString(36).slice(2, 10)}`;
  const title = (body.title?.trim() || "New shopping list").slice(0, 80);
  const itemCount = body.items?.length ?? 0;
  const summary: HomeListSummary = {
    listId,
    title,
    status: "DRAFT",
    itemCount,
    updatedAt: createdAt,
  };
  recentLists = [summary, ...recentLists.filter((l) => l.listId !== listId)];
  return {
    stub: true,
    listId,
    title,
    status: "DRAFT",
    itemCount,
    createdAt,
    nextPath: `/orders/${listId}/create`,
  };
}
