/** In-memory Home stubs for customer click-throughs. Not persisted; no MoMo/escrow. */

export type ListStatus = "draft" | "active" | "delivered" | "cancelled";

export type HomeListSummary = {
  /** Prefer this in FE (alias of listId). */
  id: string;
  listId: string;
  title: string;
  status: ListStatus;
  itemCount: number;
  updatedAt: string;
  /** Human label for Home rows, e.g. "Yesterday". */
  updatedLabel: string;
};

export type ActiveOrderSummary = {
  /** Prefer this in FE (alias of orderId). */
  id: string;
  orderId: string;
  listId: string;
  title: string;
  riderName: string | null;
  /** Display status for Home chip, e.g. "En route". */
  status: string;
  itemCount: number;
  etaMinutes: number | null;
  destinationArea: string | null;
  pinReady: boolean;
  /** UX canonical stage (Create…Settle). */
  stage: string;
  stageLabel: string;
  progressPct: number;
  /** Masked only — never raw PIN. */
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

const nowIso = () => new Date().toISOString();

function updatedLabelFromIso(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString("en-UG", {
    month: "short",
    day: "numeric",
  });
}

/** Seed matches Sharon Home mock (FE PR #4). */
let recentLists: HomeListSummary[] = [
  {
    id: "list_weekend",
    listId: "list_weekend",
    title: "Weekend groceries",
    status: "draft",
    itemCount: 8,
    updatedAt: "2026-09-10T08:00:00.000Z",
    updatedLabel: "Today",
  },
  {
    id: "list_office",
    listId: "list_office",
    title: "Office snacks",
    status: "delivered",
    itemCount: 5,
    updatedAt: "2026-09-08T14:30:00.000Z",
    updatedLabel: "2 days ago",
  },
];

let activeOrder: ActiveOrderSummary | null = {
  id: "ord_demo",
  orderId: "ord_demo",
  listId: "list_active",
  title: "Nakasero market run",
  riderName: "Juma",
  status: "En route",
  itemCount: 6,
  etaMinutes: 12,
  destinationArea: "Kololo",
  pinReady: true,
  stage: "Deliver",
  stageLabel: "En route",
  progressPct: 75,
  pinHint: "••42",
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
    id: listId,
    listId,
    title,
    status: "draft",
    itemCount,
    updatedAt: createdAt,
    updatedLabel: updatedLabelFromIso(createdAt),
  };
  recentLists = [summary, ...recentLists.filter((l) => l.listId !== listId)];
  return {
    stub: true,
    id: listId,
    listId,
    title,
    status: "draft",
    itemCount,
    createdAt,
    nextPath: `/orders/${listId}/create`,
  };
}
