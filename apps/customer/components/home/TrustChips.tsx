const CHIPS = [
  "Verified riders",
  "MoMo escrow",
  "GPS",
  "PIN handover",
] as const;

export function TrustChips() {
  return (
    <ul className="flex flex-wrap gap-2">
      {CHIPS.map((label) => (
        <li
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#ECE8E2] px-2.5 py-1.5 text-[11px] font-medium text-ink"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-green"
            aria-hidden
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
