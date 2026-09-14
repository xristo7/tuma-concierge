/** Core domain DTOs — kept in sync with apps/api's real (non-stub) responses. */

export type ListStatus = "draft" | "active" | "delivered" | "cancelled";

export type ListSummary = {
  id: string;
  listId: string;
  title: string;
  status: ListStatus;
  itemCount: number;
  updatedAt: string;
};

export type ListItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  note: string | null;
  unit_price: number | null;
};

export type ListRow = {
  id: string;
  customer_id: string;
  title: string;
  status: ListStatus;
  created_at: string;
  updated_at: string;
};

export type ListDetail = {
  list: ListRow;
  items: ListItem[];
};

export type OrderType = "shopping" | "parcel";

export type OrderRow = {
  id: string;
  list_id: string;
  customer_id: string;
  customer_name: string | null;
  rider_id: string | null;
  stage: string;
  type: OrderType;
  payment_rail: "escrow" | "float" | null;
  currency: string;
  estimated_total: number | null;
  final_total: number | null;
  pickup_area: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_area: string | null;
  destination_address: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  distance_km: number | null;
  matched_out_of_range: number;
  pin_code: string | null;
  eta_minutes: number | null;
  created_at: string;
  updated_at: string;
};

/** Admin-tunable delivery pricing/matching numbers (packages/shared/src/api-client.ts: getSettings/adminUpdateSettings). */
export type DeliverySettings = {
  deliveryRatePerKm: number;
  serviceRangeKm: number;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  stage: string;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

export type Substitution = {
  id: string;
  order_id: string;
  item_id: string | null;
  original_name: string;
  substitute_name: string;
  price_delta: number;
  status: "pending" | "approved" | "rejected";
  batch_id: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  type: "collection" | "disbursement" | "refund";
  provider: string;
  provider_ref: string | null;
  msisdn: string | null;
  amount: number;
  currency: string;
  status: "pending" | "successful" | "failed";
  created_at: string;
};

export type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: "customer" | "rider" | "admin";
  body: string;
  created_at: string;
};

export type Rider = {
  user_id: string;
  verified: number;
  is_online: number;
  area: string | null;
  vehicle_info: string | null;
  rating: number;
  momo_msisdn: string | null;
  first_name: string | null;
  last_name: string | null;
  alt_phone: string | null;
  stage_address: string | null;
  home_address: string | null;
  stage_lat: number | null;
  stage_lng: number | null;
  stage_name: string | null;
  stage_chairman_name: string | null;
  stage_chairman_contact: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  national_id_key: string | null;
  profile_completed_at: string | null;
};

/** The fields a rider must fill in (incl. their motorcycle reg. via `vehicle_info`,
 * a National ID scan, and a stage location picked on the map) before they're
 * eligible for admin verification/approval to take jobs. */
export function isRiderProfileComplete(rider: Rider | null | undefined): boolean {
  if (!rider) return false;
  return Boolean(
    rider.first_name &&
      rider.last_name &&
      rider.vehicle_info &&
      rider.stage_address &&
      rider.stage_lat != null &&
      rider.stage_lng != null &&
      rider.home_address &&
      rider.stage_name &&
      rider.stage_chairman_name &&
      rider.stage_chairman_contact &&
      rider.emergency_contact_name &&
      rider.emergency_contact_phone &&
      rider.national_id_key,
  );
}

/** Shape returned by the admin rider-listing endpoints: a `Rider` row joined with its user record. */
export type AdminRider = Rider & {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: UserStatus;
};

export type SavedLocation = {
  id: string;
  user_id: string;
  label: string;
  area: string | null;
  address: string | null;
  created_at: string;
};

export type UserStatus = "active" | "suspended";

export type AuthUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  role: "customer" | "rider" | "admin";
  status: UserStatus;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
};

/** True once either phone or email has been confirmed via OTP — the two
 * channels are interchangeable, only one needs to succeed. */
export function isUserVerified(user: AuthUser | null | undefined): boolean {
  return !!user && (!!user.phoneVerifiedAt || !!user.emailVerifiedAt);
}

export type AdminCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: UserStatus;
  created_at: string;
  order_count: number;
};

export type AdminStats = {
  totalCustomers: number;
  totalRiders: number;
  verifiedRiders: number;
  onlineRiders: number;
  ordersByStage: Record<string, number>;
  paymentsByStatus: Record<string, number>;
  settledGmv: number;
};

export type IntegrationsStatus = {
  momo: { configured: boolean; targetEnv: string; baseUrl: string };
  storage: { configured: boolean };
};

export type FailedPayment = {
  id: string;
  order_id: string;
  type: "collection" | "disbursement" | "refund";
  amount: number;
  currency: string;
  msisdn: string | null;
  created_at: string;
};

/** `OrderRow` joined with the assigned rider's name, as returned by admin listings. */
export type AdminOrderRow = OrderRow & { rider_name: string | null };

export type OrderDetail = {
  order: OrderRow;
  items: ListItem[];
  events: OrderEvent[];
  substitutions: Substitution[];
  payments: Payment[];
};

export type CreateListBody = {
  title?: string;
  items?: Array<{ name: string; quantity?: number; unitCost?: number; note?: string }>;
};

export type CreateListResponse = {
  id: string;
  listId: string;
  title: string;
  status: "draft";
  itemCount: number;
  createdAt: string;
  nextPath: string;
};
