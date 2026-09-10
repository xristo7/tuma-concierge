import type {
  ActiveOrderSummary,
  CreateListDraftBody,
  CreateListDraftResponse,
  HomeListSummary,
  HomePayload,
} from "./home";

export type CreateApiClientOptions = {
  baseUrl: string;
  /** Optional fetch override (tests). */
  fetchImpl?: typeof fetch;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * API client for tuma-api (apps/api on Render).
 * Home methods hit live stubs; older placeholders remain until feature APIs land.
 */
export function createApiClient({ baseUrl, fetchImpl }: CreateApiClientOptions) {
  const root = baseUrl.replace(/\/$/, "");
  const f = fetchImpl ?? fetch;

  return {
    baseUrl: root,

    async getHealth(): Promise<{ ok: boolean; service?: string }> {
      return json(await f(`${root}/health`));
    },

    async getHome(): Promise<HomePayload> {
      return json(await f(`${root}/v1/home`));
    },

    async getActiveOrder(): Promise<{
      stub: true;
      activeOrder: ActiveOrderSummary | null;
    }> {
      return json(await f(`${root}/v1/orders/active`));
    },

    async getRecentLists(limit = 10): Promise<{ stub: true; lists: HomeListSummary[] }> {
      return json(await f(`${root}/v1/lists/recent?limit=${limit}`));
    },

    async createListDraft(body: CreateListDraftBody = {}): Promise<CreateListDraftResponse> {
      return json(
        await f(`${root}/v1/lists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },

    async getOrder(_orderId: string): Promise<null> {
      return null;
    },

    async listOrders(): Promise<unknown[]> {
      return [];
    },

    async listJobs(): Promise<unknown[]> {
      return [];
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
