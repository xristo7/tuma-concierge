"use client";

import type { ListSummary } from "@tuma/shared";
import { ChevronRight, Clock, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

function statusClasses(status: string) {
  if (status === "delivered") return "bg-green/15 text-green";
  return "bg-[#E8E4DE] text-ink-500";
}

export function RecentLists() {
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getRecentLists(10)
      .then((res) => {
        if (!cancelled) setLists(res.lists);
      })
      .catch(() => {
        if (!cancelled) setLists([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || lists.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-ink">Recent lists</h2>
        <Link href="/orders" className="text-sm font-medium text-ink-500 hover:text-ink">
          See all
        </Link>
      </div>

      <ul className="space-y-2.5">
        {lists.map((list) => (
          <li key={list.id}>
            <Link
              href="/orders"
              className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${statusClasses(list.status)}`}>
                <ShoppingBag className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{list.title}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                  <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
                  {list.itemCount} items
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusClasses(list.status)}`}>
                {list.status}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
