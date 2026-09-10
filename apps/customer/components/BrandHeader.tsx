import { ChevronDown, MapPin } from "lucide-react";

export function BrandHeader() {
  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-1 pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/tuma-logo-helmet-wordmark.svg"
          alt="Tuma"
          width={120}
          height={28}
          className="h-7 w-auto"
        />
        <button
          type="button"
          className="inline-flex max-w-[58%] items-center gap-1.5 rounded-full border border-[var(--border-faint)] bg-white px-3 py-1.5 text-left shadow-sm"
          aria-label="Change location"
        >
          <MapPin
            className="h-3.5 w-3.5 shrink-0 text-gold"
            strokeWidth={2.25}
            aria-hidden
          />
          <span className="truncate text-xs font-medium text-ink">
            Kampala · within 5 km
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-ink-500"
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </div>
    </header>
  );
}
