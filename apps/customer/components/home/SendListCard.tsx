import { Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";

export function SendListCard() {
  return (
    <section className="home-card relative overflow-hidden border-t-[3px] border-t-gold !px-5 !py-5">
      <div className="mb-3 flex items-center gap-1.5">
        <ShoppingBag
          className="h-4 w-4 text-gold"
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gold">
          Shopping list
        </span>
      </div>
      <h2 className="text-xl font-bold tracking-tight text-ink">
        Send your list
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
        A verified rider shops & delivers — markets, shops, or that one stall
        you trust.
      </p>
      <Link
        href="/orders/new"
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-3 text-base font-bold text-ink shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity hover:opacity-95"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        New list
      </Link>
    </section>
  );
}
