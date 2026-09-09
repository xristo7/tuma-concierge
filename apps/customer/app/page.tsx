import { ORDER_STAGES, PaymentRail } from "@tuma/shared";
import { Clock, Lock, ShoppingBag } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Tuma Customer
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Scaffold shell — stages from <code>@tuma/shared</code>
        </p>
      </header>

      <section className="card !py-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Brand icons (Lucide)
        </h2>
        <ul className="flex gap-6 text-ink">
          <li className="flex flex-col items-center gap-1 text-xs">
            <Clock className="h-6 w-6 text-gold" strokeWidth={1.75} aria-hidden />
            Clock
          </li>
          <li className="flex flex-col items-center gap-1 text-xs">
            <ShoppingBag className="h-6 w-6 text-green" strokeWidth={1.75} aria-hidden />
            ShoppingBag
          </li>
          <li className="flex flex-col items-center gap-1 text-xs">
            <Lock className="h-6 w-6 text-ink" strokeWidth={1.75} aria-hidden />
            Lock
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Order stages
        </h2>
        <ol className="space-y-2">
          {ORDER_STAGES.map((stage, i) => (
            <li key={stage}>
              <Link
                href={`/orders/demo/${stage.toLowerCase()}`}
                className="card !py-3 flex items-center gap-2 text-sm hover:border-gold/40"
              >
                <span className="w-5 text-ink-500">{i + 1}.</span>
                {stage}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="card text-sm">
        <p className="font-medium text-ink">Payment rails</p>
        <p className="mt-1 text-ink-500">
          {PaymentRail.escrow} · {PaymentRail.float}
        </p>
      </section>
    </div>
  );
}
