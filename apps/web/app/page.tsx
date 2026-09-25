import {
  Bike,
  Package,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const CUSTOMER_APP_URL = "https://customer.tumaffe.online";
const RIDER_APP_URL = "https://rider.tumaffe.online";
const RESTAURANT_APP_URL = "https://restaurant.tumaffe.online";

const SERVICES = [
  {
    title: "Book a Ride",
    subtitle: "Get picked up, go anywhere in the city.",
    icon: Bike,
    gradient: "linear-gradient(135deg, #2FA36B 0%, #1B6B47 65%, #0E3A27 100%)",
  },
  {
    title: "Order Food",
    subtitle: "Browse restaurants near you and get it delivered hot.",
    icon: UtensilsCrossed,
    gradient: "linear-gradient(135deg, #E6B23D 0%, #C9A227 65%, #8A6E15 100%)",
  },
  {
    title: "Shopping List",
    subtitle: "Send a list — your rider shops it and brings it to you.",
    icon: ShoppingCart,
    gradient: "linear-gradient(135deg, #3D66A6 0%, #153A75 65%, #0C2245 100%)",
  },
  {
    title: "Parcel Delivery",
    subtitle: "Send or receive a package, anywhere in town.",
    icon: Package,
    gradient: "linear-gradient(135deg, #A87B4C 0%, #7A5936 65%, #4A3620 100%)",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Tell us what you need",
    body: "Book a ride, send a shopping list, order food, or drop off a parcel — right from the app.",
  },
  {
    n: "2",
    title: "Get matched with a verified rider",
    body: "A nearby, ID-verified rider picks up your order and heads your way.",
  },
  {
    n: "3",
    title: "Track it live",
    body: "Watch your rider on the map and chat with them the whole way, in English or Luganda.",
  },
  {
    n: "4",
    title: "Delivered, paid safely",
    body: "Pay by mobile money or cash — funds are held safely in escrow until you confirm delivery.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <Image src="/brand/tuma-logo-navy.png" alt="Tuma" width={110} height={28} className="h-7 w-auto dark:hidden" priority />
        <Image
          src="/brand/tuma-logo-white.png"
          alt="Tuma"
          width={110}
          height={28}
          className="hidden h-7 w-auto dark:block"
          priority
        />
        <a
          href={CUSTOMER_APP_URL}
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity hover:opacity-90"
        >
          Open the app
        </a>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-start gap-6 py-10 sm:py-16">
        <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy dark:bg-navy/20">
          Uganda's delivery &amp; errands platform
        </span>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
          Rides, food, shopping &amp; parcels — one app, verified riders.
        </h1>
        <p className="max-w-xl text-lg text-ink-500">
          Fast. Reliable. Trusted. Tuma connects you with verified riders across your city so you can get
          picked up, fed, stocked up, or delivered to — without the guesswork.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={CUSTOMER_APP_URL}
            className="rounded-full bg-gold px-6 py-3.5 text-base font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity hover:opacity-90"
          >
            Open the app
          </a>
          <a
            href={RIDER_APP_URL}
            className="rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-6 py-3.5 text-base font-bold text-ink transition-colors hover:bg-[rgb(var(--surface-muted))]"
          >
            Become a rider
          </a>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="space-y-6 py-10">
        <div>
          <h2 className="text-2xl font-bold text-ink">Everything, in one app</h2>
          <p className="mt-1 text-ink-500">Four ways to get things done, all with the same verified-rider network.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="relative flex h-40 flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-lg"
              style={{ background: s.gradient }}
            >
              <s.icon className="pointer-events-none absolute -bottom-6 -right-4 h-36 w-36 text-white/10" strokeWidth={1.25} aria-hidden />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-black/25 text-white">
                <s.icon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <span className="relative">
                <span className="block text-lg font-bold leading-tight text-white">{s.title}</span>
                <span className="block text-sm text-white/75">{s.subtitle}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="space-y-6 py-10">
        <div>
          <h2 className="text-2xl font-bold text-ink">How it works</h2>
          <p className="mt-1 text-ink-500">From request to doorstep, in four simple steps.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((step) => (
            <div key={step.n} className="card flex gap-4 !p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-extrabold text-ink-gold">
                {step.n}
              </span>
              <div>
                <p className="font-bold text-ink">{step.title}</p>
                <p className="mt-1 text-sm text-ink-500">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="space-y-6 py-10">
        <div>
          <h2 className="text-2xl font-bold text-ink">Why people trust Tuma</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card !p-5">
            <ShieldCheck className="h-6 w-6 text-gold" strokeWidth={2} aria-hidden />
            <p className="mt-3 font-bold text-ink">Verified riders</p>
            <p className="mt-1 text-sm text-ink-500">Every rider is ID-checked before they can accept a single order.</p>
          </div>
          <div className="card !p-5">
            <Wallet className="h-6 w-6 text-gold" strokeWidth={2} aria-hidden />
            <p className="mt-3 font-bold text-ink">Escrow-protected payments</p>
            <p className="mt-1 text-sm text-ink-500">Your money is held safely and only released once delivery is confirmed.</p>
          </div>
          <div className="card !p-5">
            <Star className="h-6 w-6 text-gold" strokeWidth={2} aria-hidden />
            <p className="mt-3 font-bold text-ink">Built for Uganda</p>
            <p className="mt-1 text-sm text-ink-500">Mobile money, cash on delivery, and a Luganda-language app — made for how you already pay and speak.</p>
          </div>
        </div>
      </section>

      {/* Become a rider */}
      <section id="riders" className="py-10">
        <div className="card flex flex-col items-start gap-4 !p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-ink">Earn as a Tuma rider</h2>
            <p className="mt-2 max-w-md text-ink-500">
              Set your own hours, claim jobs near you, and get paid straight to your mobile money wallet after
              every delivery.
            </p>
          </div>
          <a
            href={RIDER_APP_URL}
            className="shrink-0 rounded-full bg-gold px-6 py-3.5 text-base font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] transition-opacity hover:opacity-90"
          >
            Sign up to ride
          </a>
        </div>
      </section>

      {/* Restaurants */}
      <section id="restaurants" className="py-10">
        <div className="card flex flex-col items-start gap-4 !p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy dark:bg-navy/20">
              <Store className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="mt-3 text-2xl font-bold text-ink">List your restaurant on Tuma</h2>
            <p className="mt-2 max-w-md text-ink-500">
              Reach hungry customers across your city and let Tuma's verified riders handle delivery for you.
            </p>
          </div>
          <a
            href={RESTAURANT_APP_URL}
            className="shrink-0 rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-6 py-3.5 text-base font-bold text-ink transition-colors hover:bg-[rgb(var(--surface-card))]"
          >
            Join as a restaurant
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 space-y-4 border-t border-[var(--border-faint)] pt-8 text-sm text-ink-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Image src="/brand/tuma-logo-navy.png" alt="Tuma" width={90} height={24} className="h-6 w-auto dark:hidden" />
          <Image src="/brand/tuma-logo-white.png" alt="Tuma" width={90} height={24} className="hidden h-6 w-auto dark:block" />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="#services" className="hover:text-ink">
              Services
            </Link>
            <Link href="#how-it-works" className="hover:text-ink">
              How it works
            </Link>
            <Link href="#riders" className="hover:text-ink">
              Riders
            </Link>
            <Link href="#restaurants" className="hover:text-ink">
              Restaurants
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <a href="mailto:support@tumaffe.online" className="hover:text-ink">
            support@tumaffe.online
          </a>
          <span className="hidden sm:inline">·</span>
          <a href="tel:+256783335335" className="hover:text-ink">
            0783 335 335
          </a>
          <span className="hidden sm:inline">·</span>
          <a href="tel:+256756384715" className="hover:text-ink">
            0756 384 715
          </a>
        </div>
        <p>© {new Date().getFullYear()} Tuma. All rights reserved.</p>
      </footer>
    </div>
  );
}
