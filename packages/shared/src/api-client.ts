import type { AdminRole } from "./permissions.js";
import type {
  ActivityLogEntry,
  AdminCustomer,
  AdminOrderRow,
  AdminRider,
  AdminStats,
  AuthUser,
  AvailableJob,
  Call,
  CallProviderIdentity,
  CallsAdminSettings,
  ChatMessage,
  ChatThread,
  ChatThreadDetail,
  CreateListBody,
  CreateListResponse,
  CustomerWallet,
  DeliverySettings,
  FailedPayment,
  IntegrationsStatus,
  IceServer,
  IncomingCall,
  ListDetail,
  ListItem,
  ListSummary,
  MapsAdminSettings,
  MapsProviderIdentity,
  MatchingMode,
  NavMode,
  OrderDetail,
  OrderRow,
  SdpDescription,
  OrderType,
  Payment,
  PaymentProviderIdentity,
  PlatformEnvironment,
  Restaurant,
  AdminRestaurant,
  RestaurantStatus,
  RestaurantChatMessage,
  RestaurantChatThread,
  RestaurantMenu,
  MenuCategory,
  MenuItem,
  MenuItemOption,
  MobileNumberPurpose,
  Rider,
  RiderApplicant,
  RiderSubscriptionPayment,
  RiderSubscriptionView,
  SavedLocation,
  SavedMobileNumber,
  StaffMember,
  UserStatus,
  Wallet,
  WalletShares,
  WalletTopup,
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

/** Thrown by the API client on any non-2xx response. Keeps the raw HTTP
 * status and the server's machine-readable error code (when it sent one)
 * separate from the human-readable message, so callers can map `code` to
 * friendly copy instead of showing "API 400: invalid_category" to users. */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, code: string | undefined, message: string) {
    super(`API ${status}: ${message}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Known server error codes mapped to plain-English copy. Anything not
 * listed here falls back to a generic, still-friendly message rather than
 * surfacing the raw code or HTTP status to the user. */
const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  not_found: "We couldn't find that. It may have been removed — please refresh and try again.",
  invalid_category: "That category no longer exists. Refresh the page and try again.",
  invalid_choice: "One of the options you picked is no longer available. Please review your order and try again.",
  item_unavailable: "That item is no longer available.",
  restaurant_closed: "This restaurant is currently closed.",
  restaurant_inactive: "This restaurant isn't accepting orders right now.",
  forbidden: "You don't have permission to do that.",
  unauthorized: "Please sign in again to continue.",
  validation_error: "Some information is missing or invalid. Please check the form and try again.",
  invalid_input: "Some information is missing or invalid. Please check the form and try again.",
  network_error: "Couldn't connect. Please check your internet connection and try again.",
};

/** Turns any error from the API client into a message safe to show a user —
 * never a raw "API 400: xxx" string. Use this (or an app's local wrapper
 * around it) at every UI call site instead of `err.message`. */
export function friendlyErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && FRIENDLY_ERROR_MESSAGES[err.code]) return FRIENDLY_ERROR_MESSAGES[err.code];
    if (err.status >= 500) return "Something went wrong on our end. Please try again in a moment.";
    if (err.status === 401 || err.status === 403) return "You don't have permission to do that.";
    if (err.status === 404) return FRIENDLY_ERROR_MESSAGES.not_found;
    return "Something went wrong. Please try again.";
  }
  if (err instanceof TypeError) return FRIENDLY_ERROR_MESSAGES.network_error;
  return "Something went wrong. Please try again.";
}

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
      const code = (body as { error?: string }).error;
      const message = (body as { message?: string }).message ?? code ?? res.statusText;
      throw new ApiError(res.status, code, message);
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

    /** Change password while signed in, given the current one — e.g. from an account settings
     * page. Returns a fresh token for this session (unaffected); every other signed-in session
     * is ended. */
    async changePassword(currentPassword: string, newPassword: string) {
      return request<{ token: string; user: AuthUser }>("/v1/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
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
      /** A passenger ride rather than a goods parcel — only meaningful with type: "parcel". */
      isRide?: boolean;
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

    // Restaurant browsing + food checkout — see apps/api/src/restaurants/customer.ts.
    async listRestaurants() {
      return request<{ restaurants: Restaurant[] }>("/v1/restaurants");
    },
    async getRestaurant(id: string) {
      return request<{ restaurant: Restaurant }>(`/v1/restaurants/${id}`);
    },
    async getRestaurantMenu(id: string) {
      return request<RestaurantMenu>(`/v1/restaurants/${id}/menu`);
    },
    /** Server computes every price from the menu — the client only ever
     * says *which* item/choices, never what they cost. */
    async orderFromRestaurant(
      restaurantId: string,
      input: {
        items: Array<{ menuItemId: string; quantity: number; choiceIds?: string[] }>;
        destinationArea?: string;
        destinationAddress?: string;
        destinationLat?: number;
        destinationLng?: number;
        paymentRail?: "escrow" | "float";
      },
    ) {
      return request<{ order: OrderRow }>(`/v1/restaurants/${restaurantId}/order`, {
        method: "POST",
        body: JSON.stringify(input),
      });
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
    /** Rider offers for a "nearest_window"/"customer_selects" job — doesn't assign it outright, see claimOrder. */
    async applyForOrder(orderId: string) {
      return request<{ ok: true }>(`/v1/orders/${orderId}/apply`, { method: "POST" });
    },
    /** The applicant pool for a "customer_selects" order, for the customer to compare and pick from. */
    async getApplicants(orderId: string) {
      return request<{ applicants: RiderApplicant[] }>(`/v1/orders/${orderId}/applicants`);
    },
    /** Customer's pick from the applicant pool — assigns that rider and turns away the rest. */
    async selectApplicant(orderId: string, riderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/applicants/${riderId}/select`, { method: "POST" });
    },
    /** Rider backs out of a job they were matched to — it drops back into the matching pool for another rider. */
    async cancelOrder(orderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/cancel`, { method: "POST" });
    },
    async fundOrder(orderId: string, input: { msisdn?: string; useWallet?: boolean; walletOwnerId?: string } = {}) {
      return request<{
        order: OrderRow;
        payment?: { id: string; status: string; network: string | null };
        redirectUrl?: string;
        funded?: boolean;
        rail?: string;
      }>(`/v1/orders/${orderId}/fund`, { method: "POST", body: JSON.stringify(input) });
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
    /** Attaches a spoken reason to a fee proposal — deliberately not transcribed (a
     * non-English recording would just come back as gibberish text), so it travels
     * as raw audio instead, alongside whatever the rider typed. */
    async uploadFeeProposalVoiceNote(orderId: string, proposalId: string, audio: Blob) {
      const form = new FormData();
      form.append("audio", audio, "voice-note.webm");
      const res = await f(`${root}/v1/orders/${orderId}/fee-proposals/${proposalId}/voice-note`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ order: OrderRow }>(res);
    },
    async feeProposalVoiceNoteBlob(orderId: string, proposalId: string): Promise<Blob> {
      const res = await f(`${root}/v1/orders/${orderId}/fee-proposals/${proposalId}/voice-note`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load voice note`);
      return res.blob();
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
    /** Rider's own "I've arrived" tap — notifies the customer. */
    async arrivedOrder(orderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/arrived`, { method: "POST" });
    },
    /** Ride only: rider confirms the passenger is aboard and they're now heading to the destination. */
    async pickedUpOrder(orderId: string) {
      return request<{ order: OrderRow }>(`/v1/orders/${orderId}/picked-up`, { method: "POST" });
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
    async rateOrder(orderId: string, input: { rating: number; comment?: string; recommended?: boolean }) {
      return request<{ ok: true; rating: number; comment: string | null; recommended: boolean }>(
        `/v1/orders/${orderId}/rate`,
        { method: "POST", body: JSON.stringify(input) },
      );
    },
    /** The customer's standing preference for how riders get assigned to their orders — null defers to admin's default. */
    async updateMatchingPreference(defaultMatchingMode: MatchingMode | null) {
      return request<{ defaultMatchingMode: MatchingMode | null }>("/v1/me/matching-preference", {
        method: "PUT",
        body: JSON.stringify({ defaultMatchingMode }),
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
    /** Sends a photo or voice note as a chat message. `file` is a browser File/Blob. */
    async sendChatMedia(orderId: string, type: "image" | "voice", file: Blob) {
      const form = new FormData();
      form.append("type", type);
      form.append("file", file, type === "image" ? "photo.jpg" : "voice.webm");
      const res = await f(`${root}/v1/orders/${orderId}/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ id: string }>(res);
    },
    /** Fetches a chat message's photo/voice note as a Blob (not JSON — raw fetch). */
    async chatMediaBlob(messageId: string): Promise<Blob> {
      const res = await f(`${root}/v1/chat/media/${messageId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load chat media`);
      return res.blob();
    },
    /** The Chat tab's conversation list — every counterpart this user has ever messaged, most recent first. */
    async getChatThreads() {
      return request<{ threads: ChatThread[] }>("/v1/chat/threads");
    },
    /** Opens a conversation by counterpart — resolves the order to send through plus the full shared history. */
    async getChatThread(counterpartId: string) {
      return request<ChatThreadDetail>(`/v1/chat/threads/${counterpartId}`);
    },
    /** Marks this order's conversation as read up to now — clears the unread badge for its counterpart. */
    async markChatRead(orderId: string) {
      return request<{ ok: true }>(`/v1/orders/${orderId}/chat/read`, { method: "POST" });
    },

    // Push notifications
    async subscribePush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
      return request<{ ok: true }>("/v1/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
      });
    },
    async unsubscribePush(endpoint: string) {
      return request<{ ok: true }>("/v1/push/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint }),
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
    /** Item-level detail for a still-open job — the available-jobs feed itself withholds this until claimed. */
    async previewJob(orderId: string) {
      return request<{ items: ListItem[] }>(`/v1/riders/jobs/${orderId}/preview`);
    },
    async myWallet() {
      return request<Wallet>("/v1/riders/me/wallet");
    },
    /** Omit `amount` to withdraw everything above the reserve (if any); pass
     * one to leave more than that behind — never less. `mobileNumberId` is
     * required once the rider has 2 saved withdrawal numbers (no reasonable
     * default between them), optional with 0 or 1 saved. */
    async withdrawWallet(amount?: number, mobileNumberId?: string) {
      return request<{ withdrawalId: string; amount: number; status: "pending" }>("/v1/riders/me/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ ...(amount != null ? { amount } : {}), ...(mobileNumberId ? { mobileNumberId } : {}) }),
      });
    },
    async refreshWithdrawal(id: string) {
      return request<{ withdrawal: Wallet["withdrawals"][number] }>(`/v1/riders/me/wallet/withdrawals/${id}/refresh`);
    },
    /** Pays out the rider's entire balance (reserve included) and locks the
     * account — refused if they've got an order in flight. */
    async closeRiderAccount() {
      return request<{ ok: true; paidOut: number }>("/v1/riders/me/close-account", { method: "POST" });
    },

    // Restaurants — Phase 1 (see apps/api/src/restaurants/routes.ts). Not
    // yet a first-class account role; any signed-in customer can apply.
    async applyAsRestaurant(input: {
      name: string;
      description?: string;
      cuisine?: string;
      phone?: string;
      address?: string;
      lat?: number;
      lng?: number;
      openTime?: string | null;
      closeTime?: string | null;
    }) {
      return request<{ restaurant: Restaurant }>("/v1/restaurants/apply", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async myRestaurant() {
      return request<{ restaurant: Restaurant }>("/v1/restaurants/me");
    },
    async updateRestaurant(input: Partial<{
      name: string;
      description: string;
      cuisine: string;
      phone: string;
      address: string;
      lat: number;
      lng: number;
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
    }>) {
      return request<{ restaurant: Restaurant }>("/v1/restaurants/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },

    // Menu — see apps/api/src/restaurants/menu.ts.
    async myMenu() {
      return request<RestaurantMenu>("/v1/restaurants/me/menu");
    },
    async createMenuCategory(input: { name: string; sortOrder?: number }) {
      return request<{ category: MenuCategory }>("/v1/restaurants/me/menu/categories", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async updateMenuCategory(id: string, input: Partial<{ name: string; sortOrder: number }>) {
      return request<{ category: MenuCategory }>(`/v1/restaurants/me/menu/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    async deleteMenuCategory(id: string) {
      return request<{ ok: true }>(`/v1/restaurants/me/menu/categories/${id}`, { method: "DELETE" });
    },
    async createMenuItem(input: {
      name: string;
      description?: string;
      price: number;
      categoryId?: string | null;
      available?: boolean;
      prepTimeMinutes?: number;
      sortOrder?: number;
    }) {
      return request<{ item: MenuItem }>("/v1/restaurants/me/menu/items", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async updateMenuItem(
      id: string,
      input: Partial<{
        name: string;
        description: string | null;
        price: number;
        categoryId: string | null;
        available: boolean;
        prepTimeMinutes: number | null;
        sortOrder: number;
      }>,
    ) {
      return request<{ item: MenuItem }>(`/v1/restaurants/me/menu/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    async deleteMenuItem(id: string) {
      return request<{ ok: true }>(`/v1/restaurants/me/menu/items/${id}`, { method: "DELETE" });
    },
    /** Replaces the item's full option/choice set in one call — see the
     * file doc comment in apps/api/src/restaurants/menu.ts for why. */
    async setMenuItemOptions(
      itemId: string,
      options: Array<{
        name: string;
        required?: boolean;
        multiSelect?: boolean;
        choices: Array<{ name: string; priceDelta?: number }>;
      }>,
    ) {
      return request<{ options: MenuItemOption[] }>(`/v1/restaurants/me/menu/items/${itemId}/options`, {
        method: "PUT",
        body: JSON.stringify({ options }),
      });
    },
    async uploadMenuItemPhoto(itemId: string, file: Blob) {
      const form = new FormData();
      form.append("file", file);
      const res = await f(`${root}/v1/restaurants/me/menu/items/${itemId}/photo`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ ok: true }>(res);
    },
    /** Streams a menu item's photo as a Blob (not JSON — raw fetch, mirrors uploadMenuItemPhoto). */
    async menuItemPhotoBlob(itemId: string): Promise<Blob> {
      const res = await f(`${root}/v1/restaurants/menu-items/${itemId}/photo`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load photo`);
      return res.blob();
    },

    // Restaurant chat — customer <-> restaurant messaging, separate from the
    // order chat (customer/rider). One continuous thread per (restaurant,
    // customer) pair; a message can optionally reference a menu item.
    async getRestaurantChat(restaurantId: string) {
      return request<{ restaurantName: string; restaurantOwnerId: string; messages: RestaurantChatMessage[] }>(
        `/v1/restaurants/${restaurantId}/chat`,
      );
    },
    async sendRestaurantChat(restaurantId: string, body: string, menuItem?: { id: string; name: string }) {
      return request<{ id: string }>(`/v1/restaurants/${restaurantId}/chat`, {
        method: "POST",
        body: JSON.stringify({ body, menuItemId: menuItem?.id, menuItemName: menuItem?.name }),
      });
    },
    /** Mirrors sendChatMedia's own "type" + "file" multipart shape, so both composers behave identically. */
    async sendRestaurantChatMedia(restaurantId: string, type: "image" | "voice", file: Blob) {
      const form = new FormData();
      form.append("type", type);
      form.append("file", file, type === "image" ? "photo.jpg" : "voice.webm");
      const res = await f(`${root}/v1/restaurants/${restaurantId}/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ id: string }>(res);
    },
    async markRestaurantChatRead(restaurantId: string) {
      return request<{ ok: true }>(`/v1/restaurants/${restaurantId}/chat/read`, { method: "POST" });
    },
    /** Restaurant-owner side: every customer thread, and replying to one. */
    async myRestaurantChatThreads() {
      return request<{ threads: RestaurantChatThread[] }>("/v1/restaurants/me/chat/threads");
    },
    async myRestaurantChatThread(customerId: string) {
      return request<{ customerName: string | null; messages: RestaurantChatMessage[] }>(
        `/v1/restaurants/me/chat/${customerId}`,
      );
    },
    async replyRestaurantChat(customerId: string, body: string) {
      return request<{ id: string }>(`/v1/restaurants/me/chat/${customerId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    },
    async replyRestaurantChatMedia(customerId: string, type: "image" | "voice", file: Blob) {
      const form = new FormData();
      form.append("type", type);
      form.append("file", file, type === "image" ? "photo.jpg" : "voice.webm");
      const res = await f(`${root}/v1/restaurants/me/chat/${customerId}`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      return json<{ id: string }>(res);
    },
    async markRestaurantChatReadAsOwner(customerId: string) {
      return request<{ ok: true }>(`/v1/restaurants/me/chat/${customerId}/read`, { method: "POST" });
    },
    async restaurantChatMediaBlob(messageId: string): Promise<Blob> {
      const res = await f(`${root}/v1/restaurant-chat/media/${messageId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load photo`);
      return res.blob();
    },

    // Rider subscription — see apps/api/src/riders/subscription.ts.
    async myRiderSubscription() {
      return request<{ subscription: RiderSubscriptionView; payments: RiderSubscriptionPayment[] }>(
        "/v1/riders/me/subscription",
      );
    },
    async paySubscription() {
      return request<{ paymentId: string; amount: number; status: "pending"; network: string | null }>(
        "/v1/riders/me/subscription/pay",
        { method: "POST" },
      );
    },
    async refreshSubscriptionPayment(id: string) {
      return request<{ payment: RiderSubscriptionPayment }>(`/v1/riders/me/subscription/payments/${id}/refresh`);
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

    // Saved mobile money numbers — up to 2 per purpose (see
    // apps/api/src/account/mobile-numbers.ts).
    async getMobileNumbers(purpose: MobileNumberPurpose) {
      return request<{ numbers: SavedMobileNumber[] }>(`/v1/mobile-numbers?purpose=${purpose}`);
    },
    async addMobileNumber(input: { purpose: MobileNumberPurpose; phone: string; label?: string; isPrimary?: boolean }) {
      return request<{ number: SavedMobileNumber }>("/v1/mobile-numbers", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async updateMobileNumber(id: string, input: Partial<{ phone: string; label: string | null; isPrimary: boolean }>) {
      return request<{ number: SavedMobileNumber }>(`/v1/mobile-numbers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    async deleteMobileNumber(id: string) {
      return request<{ ok: true }>(`/v1/mobile-numbers/${id}`, { method: "DELETE" });
    },

    // Voice calls — see apps/api/src/calls/routes.ts. Provider-agnostic at
    // this layer; the client picks Cloudflare-specific negotiation calls
    // only once it sees call.provider === "cloudflare".
    async startCall(input: { calleeId: string; orderId?: string; restaurantId?: string }) {
      return request<{ call: Call }>("/v1/calls", { method: "POST", body: JSON.stringify(input) });
    },
    async getIncomingCall() {
      return request<{ call: IncomingCall | null }>("/v1/calls/incoming");
    },
    async getCall(id: string) {
      return request<{ call: Call }>(`/v1/calls/${id}`);
    },
    async acceptCall(id: string) {
      return request<{ call: Call }>(`/v1/calls/${id}/accept`, { method: "POST" });
    },
    async endCall(id: string, reason: "declined" | "missed" | "ended") {
      return request<{ call: Call }>(`/v1/calls/${id}/end`, { method: "POST", body: JSON.stringify({ reason }) });
    },
    async publishCallSession(id: string, offer: SdpDescription) {
      return request<{ sessionId: string; answer: SdpDescription }>(`/v1/calls/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ sdp: offer.sdp }),
      });
    },
    async pullRemoteCallTrack(id: string) {
      return request<{ requiresRenegotiation: boolean; offer?: SdpDescription }>(`/v1/calls/${id}/pull-remote`, {
        method: "POST",
      });
    },
    async renegotiateCall(id: string, answer: SdpDescription) {
      return request<{ ok: true }>(`/v1/calls/${id}/renegotiate`, { method: "POST", body: JSON.stringify({ sdp: answer.sdp }) });
    },

    // "webrtc_p2p" — direct browser-to-browser, no media relay. Free STUN
    // (+ optional admin-configured TURN) for NAT traversal; offer/answer
    // exchange is just two SDP blobs on the call row (see
    // apps/api/src/calls/routes.ts).
    async getCallIceServers() {
      return request<{ iceServers: IceServer[] }>("/v1/calls/ice-servers");
    },
    async postCallOffer(id: string, offer: SdpDescription) {
      return request<{ ok: true }>(`/v1/calls/${id}/offer`, { method: "POST", body: JSON.stringify({ sdp: offer.sdp }) });
    },
    async postCallAnswer(id: string, answer: SdpDescription) {
      return request<{ ok: true }>(`/v1/calls/${id}/answer`, { method: "POST", body: JSON.stringify({ sdp: answer.sdp }) });
    },

    // Admin — calls provider toggle + credentials (mirrors the payments
    // provider/credentials endpoints just above).
    async adminGetCallsSettings() {
      return request<CallsAdminSettings>("/v1/admin/calls-settings");
    },
    async adminSetCallsProvider(provider: CallProviderIdentity) {
      return request<{ activeProvider: CallProviderIdentity }>("/v1/admin/calls-settings", {
        method: "PUT",
        body: JSON.stringify({ provider }),
      });
    },
    async adminSaveCallCredentials(provider: Exclude<CallProviderIdentity, "mock">, fields: Record<string, string>) {
      return request<{ changed: string[] }>(`/v1/admin/calls/credentials/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
    },
    async adminClearCallCredential(provider: Exclude<CallProviderIdentity, "mock">, field: string) {
      return request<{ ok: true }>(`/v1/admin/calls/credentials/${provider}/${field}`, { method: "DELETE" });
    },

    // Admin — maps provider toggle + credentials (mirrors the calls
    // provider/credentials endpoints just above).
    async adminGetMapsSettings() {
      return request<MapsAdminSettings>("/v1/admin/maps-settings");
    },
    async adminSetMapsProvider(provider: MapsProviderIdentity) {
      return request<{ activeProvider: MapsProviderIdentity }>("/v1/admin/maps-settings", {
        method: "PUT",
        body: JSON.stringify({ provider }),
      });
    },
    async adminSaveMapsCredentials(provider: Exclude<MapsProviderIdentity, "streetmaps">, fields: Record<string, string>) {
      return request<{ changed: string[] }>(`/v1/admin/maps/credentials/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
    },
    async adminClearMapsCredential(provider: Exclude<MapsProviderIdentity, "streetmaps">, field: string) {
      return request<{ ok: true }>(`/v1/admin/maps/credentials/${provider}/${field}`, { method: "DELETE" });
    },
    async adminSetNavMode(mode: NavMode) {
      return request<{ navMode: NavMode }>("/v1/admin/nav-mode", {
        method: "PUT",
        body: JSON.stringify({ mode }),
      });
    },

    // Customer wallet — closed-loop store credit (top up, spend, no cash-out).
    async getWallet() {
      return request<CustomerWallet>("/v1/wallet");
    },
    async topUpWallet(input: { amount: number; msisdn?: string }) {
      return request<{ topupId: string; status: "pending"; network: string | null; redirectUrl?: string }>(
        "/v1/wallet/topup",
        { method: "POST", body: JSON.stringify(input) },
      );
    },
    async refreshTopup(id: string) {
      return request<{ topup: WalletTopup }>(`/v1/wallet/topups/${id}/refresh`);
    },
    /** Sends money straight into another customer's wallet by phone/email. */
    async transferWallet(input: { recipient: string; amount: number; note?: string }) {
      return request<{ balance: number; recipientName: string }>("/v1/wallet/transfer", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    /** Invites another customer to spend from this wallet on their own orders. */
    async shareWallet(input: { recipient: string }) {
      return request<{ id: string; granteeName: string; status: "pending" }>("/v1/wallet/shares", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async getWalletShares() {
      return request<WalletShares>("/v1/wallet/shares");
    },
    async acceptWalletShare(id: string) {
      return request<{ status: "active" }>(`/v1/wallet/shares/${id}/accept`, { method: "POST" });
    },
    async declineWalletShare(id: string) {
      return request<{ status: "declined" }>(`/v1/wallet/shares/${id}/decline`, { method: "POST" });
    },
    /** Owner revoking a grant, or a grantee giving up one extended to them. */
    async revokeWalletShare(id: string) {
      return request<{ status: "revoked" }>(`/v1/wallet/shares/${id}/revoke`, { method: "POST" });
    },
    /** Admin: refunds an order's collected payment back to the customer's wallet. */
    async adminRefundToWallet(orderId: string) {
      return request<{ ok: true; refunded: number }>(`/v1/admin/orders/${orderId}/refund-to-wallet`, { method: "POST" });
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
    /** The whole-platform live/sandbox switch — its own endpoint, its own
     * activity log entry, separate from the general settings save. See
     * apps/api/src/settings/routes.ts. */
    async adminSetPlatformEnvironment(environment: PlatformEnvironment) {
      return request<{ platformEnvironment: PlatformEnvironment }>("/v1/admin/platform-environment", {
        method: "PUT",
        body: JSON.stringify({ environment }),
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
    async adminListRestaurants(status?: RestaurantStatus) {
      const qs = status ? `?status=${status}` : "";
      return request<{ restaurants: AdminRestaurant[] }>(`/v1/admin/restaurants${qs}`);
    },
    async adminSetRestaurantStatus(id: string, status: RestaurantStatus) {
      return request<{ restaurant: AdminRestaurant }>(`/v1/admin/restaurants/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
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
    /** Saves whichever credential fields are non-blank for one aggregator —
     * a blank field is left untouched, not cleared. See
     * apps/api/src/payments/credentials.ts for the field definitions. */
    async adminSavePaymentCredentials(provider: PaymentProviderIdentity, fields: Record<string, string>) {
      return request<{ changed: string[] }>(`/v1/admin/payments/credentials/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
    },
    /** Clears one previously-saved credential field, reverting that field to
     * its env-var fallback (if any). */
    async adminClearPaymentCredential(provider: PaymentProviderIdentity, field: string) {
      return request<{ ok: true }>(`/v1/admin/payments/credentials/${provider}/${field}`, { method: "DELETE" });
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

    // Staff accounts — Super Admin only, enforced server-side.
    async adminListStaff() {
      return request<{ staff: StaffMember[] }>("/v1/admin/staff");
    },
    async adminStaffRoles() {
      return request<{ roles: Array<{ role: AdminRole; label: string; description: string }> }>(
        "/v1/admin/staff/roles",
      );
    },
    async adminInviteStaff(input: { name: string; email: string; phone?: string; adminRole: AdminRole }) {
      return request<{ staff: StaffMember; emailFailed?: boolean; tempPassword?: string; message?: string }>(
        "/v1/admin/staff",
        { method: "POST", body: JSON.stringify(input) },
      );
    },
    async adminChangeStaffRole(userId: string, adminRole: AdminRole) {
      return request<{ ok: true }>(`/v1/admin/staff/${userId}/role`, {
        method: "POST",
        body: JSON.stringify({ adminRole }),
      });
    },
    async adminSetStaffStatus(userId: string, status: UserStatus) {
      return request<{ ok: true }>(`/v1/admin/staff/${userId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },
    async adminResetStaffPassword(userId: string) {
      return request<{ ok: true; emailed: boolean; tempPassword?: string; message?: string }>(
        `/v1/admin/staff/${userId}/reset-password`,
        { method: "POST" },
      );
    },

    // Activity log
    async adminActivityLog(options: { limit?: number; before?: string } = {}) {
      const params = new URLSearchParams();
      if (options.limit) params.set("limit", String(options.limit));
      if (options.before) params.set("before", options.before);
      const qs = params.toString();
      return request<{ entries: ActivityLogEntry[] }>(`/v1/admin/activity${qs ? `?${qs}` : ""}`);
    },
    async adminRevertActivity(id: string) {
      return request<{ ok: true }>(`/v1/admin/activity/${id}/revert`, { method: "POST" });
    },

    // A user's own profile photo (primarily customers) — riders keep their
    // separate uploadRiderProfilePhoto/riderPhotoBlob below.
    async uploadUserProfilePhoto(file: Blob) {
      const form = new FormData();
      form.append("file", file);
      const res = await f(`${root}/v1/users/me/profile-photo`, { method: "POST", headers: authHeaders(), body: form });
      return json<{ hasProfilePhoto: true }>(res);
    },
    async deleteUserProfilePhoto() {
      return request<{ hasProfilePhoto: false }>("/v1/users/me/profile-photo", { method: "DELETE" });
    },
    async userPhotoBlob(userId: string): Promise<Blob> {
      const res = await f(`${root}/v1/users/${userId}/photo`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`API ${res.status}: failed to load photo`);
      return res.blob();
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
