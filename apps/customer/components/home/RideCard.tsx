import { ArrowRight, Bike, MapPin } from "lucide-react";

export function RideCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-44 w-full flex-col justify-between overflow-hidden rounded-3xl p-5 text-left shadow-lg transition-transform active:scale-[0.98]"
      style={{ background: "linear-gradient(135deg, #2FA36B 0%, #1B6B47 65%, #0E3A27 100%)" }}
    >
      <MapPin
        className="pointer-events-none absolute -bottom-8 -right-4 h-44 w-44 text-white/10"
        strokeWidth={1.25}
        aria-hidden
      />

      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-black/25 text-white">
        <Bike className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>

      <span className="relative">
        <span className="block text-lg font-bold leading-tight text-white">Book a Ride</span>
        <span className="block text-sm text-white/75">Get picked up, go anywhere</span>
      </span>

      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink-gold shadow-md">
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    </button>
  );
}
