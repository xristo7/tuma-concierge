import { ORDER_STAGES, PaymentRail } from "@tuma/shared";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tuma Customer</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Scaffold shell — stages from <code>@tuma/shared</code>
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Order stages
        </h2>
        <ol className="space-y-1">
          {ORDER_STAGES.map((stage, i) => (
            <li key={stage}>
              <Link
                href={`/orders/demo/${stage.toLowerCase()}`}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-emerald-300"
              >
                <span className="w-5 text-zinc-400">{i + 1}.</span>
                {stage}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
        <p className="font-medium">Payment rails</p>
        <p className="mt-1 text-zinc-600">
          {PaymentRail.escrow} · {PaymentRail.float}
        </p>
      </section>
    </div>
  );
}
