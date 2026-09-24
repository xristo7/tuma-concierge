"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { useTranslate } from "../../lib/i18n";

function greetingForKampala(now = new Date()): "greeting_morning" | "greeting_afternoon" | "greeting_evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  if (hour >= 5 && hour < 12) return "greeting_morning";
  if (hour >= 12 && hour < 17) return "greeting_afternoon";
  return "greeting_evening";
}

export function Greeting() {
  const { user } = useAuth();
  const t = useTranslate();
  const [greeting, setGreeting] = useState<"greeting_morning" | "greeting_afternoon" | "greeting_evening">(
    "greeting_morning",
  );

  useEffect(() => {
    setGreeting(greetingForKampala());
  }, []);

  const firstName = user?.name?.split(" ")[0];

  return (
    <header className="space-y-1.5">
      <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-ink">
        {t(greeting)}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-[15px] leading-snug text-ink-500">{t("greeting_subtitle")}</p>
      <p className="flex items-center gap-1.5 text-sm font-medium text-green">
        <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        {t("greeting_verified")}
      </p>
    </header>
  );
}
