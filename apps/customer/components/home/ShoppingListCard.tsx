import { NotebookPen } from "lucide-react";

export function ShoppingListCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-40 flex-col overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent, transparent 21px, var(--border-faint) 22px)",
        backgroundPosition: "0 34px",
      }}
    >
      <span className="absolute bottom-0 left-6 top-0 w-px bg-red-300/70" aria-hidden />
      <NotebookPen className="h-5 w-5 text-gold" strokeWidth={2} aria-hidden />
      <span className="mt-auto text-base font-bold leading-tight text-ink">Shopping List</span>
      <span className="text-xs text-ink-500">Items, groceries, errands</span>
    </button>
  );
}
