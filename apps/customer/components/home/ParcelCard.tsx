import { Package } from "lucide-react";

export function ParcelCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-40 flex-col overflow-hidden rounded-2xl border border-[#C9A876]/40 bg-[#D9B98A] p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
    >
      {/* packing-tape cross */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[160%] w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#EFDFC2]/70" aria-hidden />
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[160%] w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[#EFDFC2]/70" aria-hidden />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#7A5230] text-[#F7EFE1]">
        <Package className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <span className="relative mt-auto text-base font-bold leading-tight text-[#4A3216]">Parcel Delivery</span>
      <span className="relative text-xs text-[#6B4E2E]">Send or receive a package</span>
    </button>
  );
}
