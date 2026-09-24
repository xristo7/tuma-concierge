"use client";

import { ArrowRight, ShoppingBag, StickyNote } from "lucide-react";
import { useTranslate } from "../../lib/i18n";

export function ShoppingListCard({ onClick }: { onClick: () => void }) {
  const t = useTranslate();
  return (
    <button
      onClick={onClick}
      className="relative flex h-44 w-full flex-col justify-between overflow-hidden rounded-3xl p-5 text-left shadow-lg transition-transform active:scale-[0.98]"
      style={{ background: "linear-gradient(135deg, #3B7DDB 0%, #1B3E73 65%, #0F2A54 100%)" }}
    >
      <ShoppingBag
        className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-white/10"
        strokeWidth={1.25}
        aria-hidden
      />

      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-black/20 text-white">
        <StickyNote className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>

      <span className="relative">
        <span className="block text-lg font-bold leading-tight text-white">{t("shopping_title")}</span>
        <span className="block text-sm text-white/70">{t("shopping_subtitle")}</span>
      </span>

      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink-gold shadow-md">
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    </button>
  );
}
