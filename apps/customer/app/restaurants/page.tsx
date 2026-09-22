"use client";

import type { Restaurant } from "@tuma/shared";
import { ChevronRight, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listRestaurants()
      .then((res) => setRestaurants(res.restaurants))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Restaurants</h1>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {restaurants === null ? (
        <p className="py-10 text-center text-sm text-ink-500">Loading…</p>
      ) : restaurants.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-500">No restaurants available yet — check back soon.</p>
      ) : (
        <ul className="space-y-2.5">
          {restaurants.map((r) => (
            <li key={r.id}>
              <Link href={`/restaurants/${r.id}`} className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Store className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-bold text-ink">{r.name}</span>
                    {!r.is_open && (
                      <span className="shrink-0 rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-[10px] font-semibold text-ink-500">
                        Closed
                      </span>
                    )}
                  </span>
                  {(r.cuisine || r.description) && (
                    <span className="mt-0.5 block truncate text-xs text-ink-500">{r.cuisine ?? r.description}</span>
                  )}
                </span>
                <ChevronRight className="h-4.5 w-4.5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
