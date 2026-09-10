import { MapPin } from "lucide-react";
import Link from "next/link";

/** Mock active order — replace with live data later. */
const ACTIVE = {
  title: "Nakasero market run",
  status: "En route",
  meta: "Denis · boda · 8 items",
  progress: 0.75,
  eta: "~12 min",
  footer: "Heading to Kololo · PIN ready at door",
  href: "/orders/demo",
} as const;

export function ActiveOrderCard() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-ink">Active order</h2>
        <Link
          href={ACTIVE.href}
          className="text-sm font-medium text-ink-500 hover:text-ink"
        >
          Track
        </Link>
      </div>

      <Link
        href={ACTIVE.href}
        className="home-card block overflow-hidden !border-l-0 !p-0"
      >
        <div className="flex">
          <span
            className="w-1.5 shrink-0 bg-green"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-bold leading-snug text-ink">
                {ACTIVE.title}
              </h3>
              <span className="shrink-0 rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-semibold text-green">
                {ACTIVE.status}
              </span>
            </div>
            <p className="text-sm text-ink-500">{ACTIVE.meta}</p>
            <div className="flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-cream"
                role="progressbar"
                aria-valuenow={Math.round(ACTIVE.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Delivery progress"
              >
                <div
                  className="h-full rounded-full bg-green"
                  style={{ width: `${ACTIVE.progress * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-bold text-green">
                {ACTIVE.eta}
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-ink-500">
              <MapPin
                className="h-3.5 w-3.5 shrink-0 text-green"
                strokeWidth={2.25}
                aria-hidden
              />
              <span>{ACTIVE.footer}</span>
            </p>
          </div>
        </div>
      </Link>
    </section>
  );
}
