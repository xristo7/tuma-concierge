import { ArrowRight, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export function FoodCard() {
  return (
    <Link
      href="/restaurants"
      className="relative flex h-44 w-full flex-col justify-between overflow-hidden rounded-3xl p-5 text-left shadow-lg transition-transform active:scale-[0.98]"
      style={{ background: "linear-gradient(135deg, #E0B93D 0%, #A9791A 65%, #7A5710 100%)" }}
    >
      <UtensilsCrossed
        className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-white/10"
        strokeWidth={1.25}
        aria-hidden
      />

      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-black/20 text-white">
        <UtensilsCrossed className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>

      <span className="relative">
        <span className="block text-lg font-bold leading-tight text-white">Order Food</span>
        <span className="block text-sm text-white/70">Browse restaurants near you</span>
      </span>

      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink-gold shadow-md">
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    </Link>
  );
}
