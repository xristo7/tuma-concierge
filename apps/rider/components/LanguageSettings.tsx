"use client";

import { useLanguage } from "../lib/i18n";

export function LanguageSettings() {
  const { language, setLanguage } = useLanguage();

  return (
    <section className="home-card space-y-2.5">
      <h2 className="text-sm font-semibold text-ink">Language</h2>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { code: "en" as const, label: "English" },
            { code: "lg" as const, label: "Luganda" },
          ]
        ).map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLanguage(opt.code)}
            className={`rounded-xl border p-2.5 text-center text-sm font-bold ${
              language === opt.code ? "border-gold bg-gold/10 text-ink" : "border-[var(--border-faint)] text-ink-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
