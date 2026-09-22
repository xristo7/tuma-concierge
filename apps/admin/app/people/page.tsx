"use client";

import { hasPermission, type AdminCustomer, type AdminRestaurant, type AdminRider, type RestaurantStatus } from "@tuma/shared";
import { ChevronRight, Search, ShieldCheck, ShieldQuestion, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type Tab = "riders" | "customers" | "restaurants";
type RiderFilter = "all" | "pending" | "verified";
type RestaurantFilter = "all" | RestaurantStatus;

const RESTAURANT_STATUS_LABEL: Record<RestaurantStatus, string> = {
  pending_approval: "Pending",
  active: "Active",
  suspended: "Suspended",
};

function StatusBadge({ status }: { status: "active" | "suspended" }) {
  if (status === "active") return null;
  return <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Suspended</span>;
}

function RidersTab() {
  const [riders, setRiders] = useState<AdminRider[]>([]);
  const [filter, setFilter] = useState<RiderFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .adminListRiders()
      .then((res) => setRiders(res.riders))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = riders.filter((r) => {
    if (filter === "pending") return !r.verified;
    if (filter === "verified") return !!r.verified;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["all", "pending", "verified"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === f ? "bg-ink text-white" : "bg-[rgb(var(--surface-muted))] text-ink-500"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {filtered.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No riders here.</p>}

      <ul className="space-y-2.5">
        {filtered.map((r) => (
          <li key={r.user_id}>
            <Link href={`/people/riders/${r.user_id}`} className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3">
              {r.verified ? (
                <ShieldCheck className="h-5 w-5 shrink-0 text-green" strokeWidth={1.75} aria-hidden />
              ) : (
                <ShieldQuestion className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.75} aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{r.name}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-500">
                  {r.phone}
                  {r.area ? ` · ${r.area}` : ""}
                </span>
              </span>
              <StatusBadge status={r.status} />
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CustomersTab() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((query: string) => {
    api
      .adminListCustomers(query || undefined)
      .then((res) => setCustomers(res.customers))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={2} aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone"
          className="w-full text-sm outline-none"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {customers.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No customers found.</p>}

      <ul className="space-y-2.5">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/people/customers/${c.id}`} className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-500">
                  {c.phone} · {c.order_count} order{c.order_count === 1 ? "" : "s"}
                </span>
              </span>
              <StatusBadge status={c.status} />
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RestaurantsTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.adminRole ?? null, "restaurants.manage");
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [filter, setFilter] = useState<RestaurantFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .adminListRestaurants()
      .then((res) => setRestaurants(res.restaurants))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: RestaurantStatus) {
    setBusyId(id);
    setError(null);
    try {
      await api.adminSetRestaurantStatus(id, status);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = restaurants.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["all", "pending_approval", "active", "suspended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === f ? "bg-ink text-white" : "bg-[rgb(var(--surface-muted))] text-ink-500"
            }`}
          >
            {f === "all" ? "All" : RESTAURANT_STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {filtered.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No restaurants here.</p>}

      <ul className="space-y-2.5">
        {filtered.map((r) => (
          <li key={r.id} className="home-card space-y-2 !rounded-2xl !px-3 !py-3">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{r.name}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-500">
                  {r.owner_name}
                  {r.cuisine ? ` · ${r.cuisine}` : ""}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.status === "active"
                    ? "bg-green/15 text-green"
                    : r.status === "suspended"
                      ? "bg-red-100 text-red-700"
                      : "bg-[rgb(var(--surface-muted))] text-ink-500"
                }`}
              >
                {RESTAURANT_STATUS_LABEL[r.status]}
              </span>
            </div>
            {canManage && (
              <div className="flex gap-2">
                {r.status !== "active" && (
                  <button
                    onClick={() => setStatus(r.id, "active")}
                    disabled={busyId === r.id}
                    className="min-h-9 flex-1 rounded-full bg-gold px-3 text-xs font-bold text-ink-gold disabled:opacity-60"
                  >
                    Approve
                  </button>
                )}
                {r.status !== "suspended" && (
                  <button
                    onClick={() => setStatus(r.id, "suspended")}
                    disabled={busyId === r.id}
                    className="min-h-9 flex-1 rounded-full border border-red-200 px-3 text-xs font-bold text-red-600 disabled:opacity-60"
                  >
                    Suspend
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PeoplePage() {
  const [tab, setTab] = useState<Tab>("riders");

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">People</h1>

      <div className="flex rounded-full bg-[rgb(var(--surface-muted))] p-1">
        {(["riders", "customers", "restaurants"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "riders" ? <RidersTab /> : tab === "customers" ? <CustomersTab /> : <RestaurantsTab />}
    </div>
  );
}
