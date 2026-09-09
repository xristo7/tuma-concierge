export type CreateApiClientOptions = {
  baseUrl: string;
};

/**
 * Stub API client — placeholders only. Real endpoints live on workers/api (Ship).
 */
export function createApiClient({ baseUrl }: CreateApiClientOptions) {
  const root = baseUrl.replace(/\/$/, "");

  return {
    baseUrl: root,
    async getHealth(): Promise<{ ok: boolean }> {
      return { ok: true };
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
