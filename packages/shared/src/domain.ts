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

export type OrderRow = {
  id: string;
  list_id: string;
  customer_id: string;
  rider_id: string | null;
  stage: string;
  payment_rail: "escrow" | "float" | null;
  currency: string;
  estimated_total: number | null;
  final_total: number | null;
  destination_area: string | null;
  destination_address: string | null;
  pin_code: string | null;
  eta_minutes: number | null;
  created_at: string;
  updated_at: string;
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
};

export type AuthUser = {
  id: string;
  phone: string;
  name: string;
  role: "customer" | "rider" | "admin";
};

export type OrderDetail = {
  order: OrderRow;
  items: ListItem[];
  events: OrderEvent[];
  substitutions: Substitution[];
  payments: Payment[];
};

export type CreateListBody = {
  title?: string;
  items?: Array<{ name: string; quantity?: number; note?: string }>;
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
