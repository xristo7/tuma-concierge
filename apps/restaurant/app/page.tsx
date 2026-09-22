"use client";

import { ChevronRight, Store, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";

export default function HomePage() {
  const { user, restaurant, restaurantReady } = useAuth();
  const router = useRouter();

  // No restaurant registered yet — send them straight to the form rather
  // than showing an empty dashboard they can't do anything with.
  useEffect(() => {
    if (restaurantReady && !restaurant) router.replace("/account");
  }, [restaurantReady, restaurant, router]);

  if (!restaurantReady) {
    return <p className="px-4 py-10 text-center text-sm text-ink-500">Loading…</p>;
  }

  if (!restaurant) return null;

  if (restaurant.status === "pending_approval") {
    return (
      <div className="space-y-5 px-4 pb-6 pt-4">
        <h1 className="text-xl font-bold text-ink">Welcome, {user?.name}</h1>
        <section className="home-card flex flex-col items-center gap-3 py-8 text-center">
          <Store className="h-10 w-10 text-gold" strokeWidth={1.5} aria-hidden />
          <p className="text-sm font-semibold text-ink">{restaurant.name} is pending approval</p>
          <p className="text-sm text-ink-500">
            An admin needs to review and approve your restaurant before customers can see it — you can build out
            your menu in the meantime, it&apos;ll be ready the moment you&apos;re approved.
          </p>
          <Link href="/menu" className="mt-2 text-sm font-bold text-gold">
            Go to Menu →
          </Link>
        </section>
      </div>
    );
  }

  if (restaurant.status === "suspended") {
    return (
      <div className="space-y-5 px-4 pb-6 pt-4">
        <h1 className="text-xl font-bold text-ink">{restaurant.name}</h1>
        <section className="home-card flex flex-col items-center gap-3 py-8 text-center !border-l-4 !border-l-red-400">
          <p className="text-sm font-semibold text-ink">This restaurant has been suspended</p>
          <p className="text-sm text-ink-500">Contact support if you think this is a mistake.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">{restaurant.name}</h1>
      <p className="text-sm text-ink-500">
        {restaurant.is_open ? "You're open — visible to customers." : "You're closed — hidden from customers until you reopen."}
      </p>

      <Link href="/menu" className="home-card flex items-center gap-3 !rounded-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <UtensilsCrossed className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-ink">Manage menu</span>
          <span className="block text-xs text-ink-500">Categories, items, prices, and options</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
      </Link>

      <section className="home-card space-y-1">
        <p className="text-sm font-semibold text-ink">Orders</p>
        <p className="text-xs text-ink-500">Coming soon — you&apos;ll see incoming orders here once ordering opens.</p>
      </section>
    </div>
  );
}
