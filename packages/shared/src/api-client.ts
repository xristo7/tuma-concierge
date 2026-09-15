import type {
  AdminCustomer,
  AdminOrderRow,
  AdminRider,
  AdminStats,
  AuthUser,
  AvailableJob,
  ChatMessage,
  CreateListBody,
  CreateListResponse,
  DeliverySettings,
  FailedPayment,
  IntegrationsStatus,
  ListDetail,
  ListSummary,
  OrderDetail,
  OrderRow,
  OrderType,
  Payment,
  Rider,
  SavedLocation,
  UserStatus,
  Wallet,
} from "./domain.js";

export type CreateApiClientOptions = {
  baseUrl: string;
  /** Optional fetch override (tests). */
  fetchImpl?: typeof fetch;
  /** Bearer token for authenticated requests. */
  getToken?: () => string | null | undefined;
  /**
   * Called when a request made *with* a token comes back 401 — the session
   * ended somewhere other than this browser. That happens on a normal
   * expiry, but also when the account is suspended, the password is reset,
   * or the session is signed out from another device.
   *
   * Without this the app keeps rendering the cached user while every call
   * behind it fails, which looks like the app is broken rather than like
   * being logged out. Not called for a failed sign-in (no token was sent).
   */
  onUnauthorized?: () => void;
};

/** API client for tuma-api (apps/api on Render). */
export function createApiClient({ baseUrl, fetchImpl, getToken, onUnauthorized }: CreateApiClientOptions) {
  const root = baseUrl.replace(/\/$/, "");
  const f = fetchImpl ?? fetch;

  function authHeaders(): Record<string, string> {
    const token = getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function json<T>(res: Response): Promise<T> {
    if (!res.ok) {
      if (res.status === 401 && getToken?.()) onUnauthorized?.();
      const body = await res.json().catch(() => ({}));
      throw new Error(
        `API ${res.status}: ${(body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? res.statusText}`,
      );
    }
    return (await res.json()) as T;
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    return json<T>(
      await f(`${root}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
          ...(init?.headers ?? {}),
        },
      }),
    );
  }

  return {
    baseUrl: root,

    async getHealth(): Promise<{ ok: boolean; service?: string }> {
      return json(await f(`${root}/health`));
    },

    // Auth — registration accepts either a phone number or an email (at
    // least one is required); login accepts either as the identifier.
    async register(input: {
      phone?: string;
      email?: string;
      name: string;
      password: string;
      role?: "customer" | "rider";
    }) {
      return request<{ token: string; user: AuthUser; riderStatus?: "pending_verification"; verifyDevCode?: string }>(
        "/v1/auth/register",
        { method: "POST", body: JSON.stringify(input) },
      );
    },
    async login(input: { identifier: string; password: string }) {
      return request<{ token: string; user: AuthUser }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    /**
     * Ends the current session server-side. Dropping the token from local
     * storage only hides it from this browser — until the server records it
     * as revoked, a copy taken beforehand still works. Callers should clear
     * local storage regardless of whether this succeeds.
     */
    async logout() {
      return request<{ ok: true }>("/v1/auth/logout", { method: "POST" });
    },
    /** Sign in/up with Google — `idToken` is the credential Google Identity Services hands the client. */
    async googleAuth(idToken: string, role?: "customer" | "rider") {
      return request<{ token: string; user: AuthUser; riderStatus?: "pending_verification" }>("/v1/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken, role }),
      });
    },
    async me() {
      return request<{ user: AuthUser }>("/v1/auth/me");
    },

    // Onboarding verification (either phone or email confirms the account)
    async requestVerification(channel: "sms" | "email") {
      return request<{ sent: true; channel: "sms" | "email"; target: string; devCode?: string }>(
        "/v1/auth/verify/request",
        { method: "POST", body: JSON.stringify({ channel }) },
      );
    },
    async confirmVerification(channel: "sms" | "email", code: string) {
      return request<{ user: AuthUser }>("/v1/auth/verify/confirm", {
        method: "POST",
        body: JSON.stringify({ channel, code }),
      });
    },

    // Forgot password — public, works while signed out.
    async requestPasswordReset(identifier: string) {
      return request<{ sent: true; channel?: "sms" | "email"; target?: string; devCode?: string; retryAfterSeconds?: number }>(
        "/v1/auth/password/reset/request",
        { method: "POST", body: JSON.stringify({ identifier }) },
      );
    },
    async confirmPasswordReset(identifier: string, code: string, newPassword: string) {
      return request<{ token: string; user: AuthUser }>("/v1/auth/password/reset/confirm", {
        method: "POST",
        body: JSON.stringify({ identifier, code, newPassword }),
      });
    },

    // Lists
    async createList(body: CreateListBody = {}) {
      return request<CreateListResponse>("/v1/lists", { method: "POST", body: JSON.stringify(body) });
    },
    async getRecentLists(limit = 10) {
      return request<{ lists: ListSummary[] }>(`/v1/lists/recent?limit=${limit}`);
    },
    async getList(listId: string) {
      return request<ListDetail>(`/v1/lists/${listId}`);
    },

    // Voice notes — transcribes a recorded shopping list into items
    async transcribeVoiceNote(audio: Blob, options: { extractItems?: boolean } = {}) {
      const form = new FormData();
      form.append("audio", audio, "note.webm");
      if (options.extractItems === false) form.append("extractItems", "false");
      const res = await f(`${root}/v1/voice/transcribe`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ transcript: string; items: Array<{ name: string; quantity: number }> }>(res);
    },

    // Orders
    async createOrder(input: {
      listId: string;
      type?: OrderType;
      pickupArea?: string;
      pickupAddress?: string;
      pickupLat?: number;
      pickupLng?: number;
      destinationArea?: string;
      destinationAddress?: string;
      destinationLat?: number;
      destinationLng?: number;
      paymentRail?: "escrow" | "float";
      estimatedTotal?: number;
    }) {
      return request<{ order: OrderRow }>("/v1/orders", { method: "POST", body: JSON.stringify(input) });
    },
    async getActiveOrder() {
      return request<{ activeOrder: OrderRow | null }>("/v1/orders/active");
    },
    async getOrder(orderId: string) {
      return request<OrderDetail>(`/v1/orders/${orderId}`);
    },
    /** Attaches a spoken note to the order — context a typed list can miss (units, brand, exactly where in the shop). */
    async uploadOrderVoiceNote(orderId: string, audio: Blob) {
      const form = new FormData();
      form.append("audio", audio, "voice-note.webm");
      const res = await f(`${root}/v1/orders/${orderId}/voice-note`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ order: OrderRow }>(res);
    },
    /** Fetches the order's voice note as a Blob (not JSON — raw fetch, mirrors adminRiderIdDocumentBlob). */
    async orderVoiceNoteBlob(orderId: string): Promise<Blob> {
      const res = await f(`${root}/v1/orders/${orderId}/voice-note`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load voice note`);
      return res.blob();
    },
    async matchOrder(orderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/match`, { method: "POST" });
    },
    /** Rider actively takes an unmatched job from their available-jobs list. */
    async claimOrder(orderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/claim`, { method: "POST" });
    },
    /** Rider backs out of a job they were matched to — it drops back into the matching pool for another rider. */
    async cancelOrder(orderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/cancel`, { method: "POST" });
    },
    async fundOrder(orderId: string, input: { msisdn?: string } = {}) {
      return request<{ order: OrderRow; payment?: { id: string; status: string } }>(
        `/v1/orders/${orderId}/fund`,
        { method: "POST", body: JSON.stringify(input) },
      );
    },
    async proposeSubstitution(
      orderId: string,
      input: { itemId?: string; originalName: string; substituteName: string; priceDelta?: number },
    ) {
      return request<{ substitution: string }>(`/v1/orders/${orderId}/substitutions`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async decideSubstitution(orderId: string, subId: string, approve: boolean) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/substitutions/${subId}/decision`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
    },
    /** Bundles several item changes (unavailable / price change) into one customer approval instead of many. */
    async proposeSubstitutionBatch(
      orderId: string,
      changes: Array<{ itemId?: string; originalName: string; substituteName: string; priceDelta?: number }>,
    ) {
      return request<{ batchId: string; order: OrderRow }>(`/v1/orders/${orderId}/substitutions/batch`, {
        method: "POST",
        body: JSON.stringify({ changes }),
      });
    },
    async decideSubstitutionBatch(orderId: string, batchId: string, approve: boolean) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/substitutions/batch/${batchId}/decision`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
    },
    /** Rider suggests a different total than the app's auto-calculated (or customer-entered) one. */
    async proposeFee(orderId: string, input: { proposedTotal: number; reason?: string }) {
      return request<{ proposalId: string; order: OrderRow }>(`/v1/orders/${orderId}/fee-proposals`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async decideFeeProposal(orderId: string, proposalId: string, approve: boolean) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/fee-proposals/${proposalId}/decision`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
    },
    async deliverOrder(orderId: string, etaMinutes?: number) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/deliver`, {
        method: "POST",
        body: JSON.stringify({ etaMinutes }),
      });
    },
    async handoverOrder(orderId: string, pin: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/handover`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    },
    async settleOrder(orderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/settle`, { method: "POST" });
    },
    async rateOrder(orderId: string, input: { rating: number; comment?: string }) {
      return request<{ ok: true; rating: number; comment: string | null }>(`/v1/orders/${orderId}/rate`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    // Chat
    async getChat(orderId: string) {
      return request<{ messages: ChatMessage[] }>(`/v1/orders/${orderId}/chat`);
    },
    async sendChat(orderId: string, body: string) {
      return request<{ id: string }>(`/v1/orders/${orderId}/chat`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    },

    // Payments
    async refreshPayment(paymentId: string) {
      return request<{ payment: Payment }>(`/v1/payments/${paymentId}/refresh`);
    },

    // Riders
    async applyAsRider(input: {
      area?: string;
      vehicleInfo?: string;
      momoMsisdn?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      altPhone?: string;
      stageAddress?: string;
      homeAddress?: string;
      stageLat?: number;
      stageLng?: number;
      stageName?: string;
      stageChairmanName?: string;
      stageChairmanContact?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    }) {
      return request<{ rider: Rider }>("/v1/riders/apply", { method: "POST", body: JSON.stringify(input) });
    },
    /** Uploads the rider's National ID scan (verification only). `file` is a browser File/Blob. */
    async uploadRiderIdDocument(file: Blob) {
      const form = new FormData();
      form.append("file", file);
      const res = await f(`${root}/v1/riders/id-document`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ rider: Rider }>(res);
    },
    /** Uploads the rider's own face photo — shown to customers once matched, mandatory for profile completion. */
    async uploadRiderProfilePhoto(file: Blob) {
      const form = new FormData();
      form.append("file", file);
      const res = await f(`${root}/v1/riders/profile-photo`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ rider: Rider }>(res);
    },
    /** Fetches a rider's profile photo as a Blob (not JSON — raw fetch; caller builds an object URL). */
    async riderPhotoBlob(userId: string): Promise<Blob> {
      const res = await f(`${root}/v1/riders/${userId}/photo`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load rider photo`);
      return res.blob();
    },
    async setRiderOnline(online: boolean) {
      return request<{ rider: Rider }>("/v1/riders/status", { method: "POST", body: JSON.stringify({ online }) });
    },
    async myRiderProfile() {
      return request<{ rider: Rider | null }>("/v1/riders/me");
    },
    async myRiderOrders() {
      return request<{ orders: OrderRow[] }>("/v1/riders/me/orders");
    },
    /** Unmatched orders currently open to this rider — nearest riders see each one first, then it widens. */
    async availableJobs() {
      return request<{ jobs: AvailableJob[] }>("/v1/riders/jobs/available");
    },
    async myWallet() {
      return request<Wallet>("/v1/riders/me/wallet");
    },
    async withdrawWallet() {
      return request<{ withdrawalId: string; amount: number; status: "pending" }>("/v1/riders/me/wallet/withdraw", {
        method: "POST",
      });
    },
    async refreshWithdrawal(id: string) {
      return request<{ withdrawal: Wallet["withdrawals"][number] }>(`/v1/riders/me/wallet/withdrawals/${id}/refresh`);
    },

    // Saved locations
    async getLocations() {
      return request<{ locations: SavedLocation[] }>("/v1/locations");
    },
    async saveLocation(input: { label: string; area?: string; address?: string; lat?: number; lng?: number }) {
      return request<{ location: SavedLocation }>("/v1/locations", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async deleteLocation(id: string) {
      return request<{ ok: true }>(`/v1/locations/${id}`, { method: "DELETE" });
    },

    // Delivery pricing settings (rate per km, service range) — public read, admin write.
    async getSettings() {
      return request<{ settings: DeliverySettings }>("/v1/settings");
    },
    async adminUpdateSettings(input: Partial<DeliverySettings>) {
      return request<{ settings: DeliverySettings }>("/v1/admin/settings", {
        method: "PUT",
        body: JSON.stringify(input),
      });
    },

    // Admin
    async adminListRiders() {
      return request<{ riders: AdminRider[] }>("/v1/admin/riders");
    },
    async adminVerifyRider(userId: string, verified: boolean) {
      return request<{ rider: Rider }>(`/v1/admin/riders/${userId}/verify`, {
        method: "POST",
        body: JSON.stringify({ verified }),
      });
    },
    /** Fetches a rider's National ID scan as a Blob (not JSON — raw fetch, mirrors uploadRiderIdDocument). */
    async adminRiderIdDocumentBlob(userId: string): Promise<Blob> {
      const res = await f(`${root}/v1/admin/riders/${userId}/id-document`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load ID document`);
      return res.blob();
    },
    async adminStats() {
      return request<{ stats: AdminStats }>("/v1/admin/stats");
    },
    async adminIntegrations() {
      return request<{ integrations: IntegrationsStatus; recentFailedPayments: FailedPayment[] }>(
        "/v1/admin/integrations",
      );
    },
    async adminListCustomers(q?: string) {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      return request<{ customers: AdminCustomer[] }>(`/v1/admin/customers${qs}`);
    },
    async adminGetCustomer(id: string) {
      return request<{ customer: AdminCustomer; orders: AdminOrderRow[] }>(`/v1/admin/customers/${id}`);
    },
    async adminListOrders(filters: { stage?: string; type?: OrderType; limit?: number } = {}) {
      const params = new URLSearchParams();
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.type) params.set("type", filters.type);
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      return request<{ orders: AdminOrderRow[] }>(`/v1/admin/orders${qs ? `?${qs}` : ""}`);
    },
    async adminSetUserStatus(userId: string, status: UserStatus) {
      return request<{ user: AuthUser }>(`/v1/admin/users/${userId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
