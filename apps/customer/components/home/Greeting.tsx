"use client";

import { useEffect, useState } from "react";

function greetingForKampala(now = new Date()): "Morning" | "Afternoon" | "Evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  return "Evening";
}

export function Greeting() {
  const [greeting, setGreeting] = useState<"Morning" | "Afternoon" | "Evening">(
    "Morning",
  );

  useEffect(() => {
    setGreeting(greetingForKampala());
  }, []);

  return (
    <header className="space-y-1.5">
      <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-ink">
        {greeting}
      </h1>
      <p className="text-[15px] leading-snug text-ink-500">
        Ready to shop? Send the list — we handle the rest.
      </p>
      <p className="text-sm font-medium text-green">
        [LG] Webale. Verified riders near you.
      </p>
    </header>
  );
}
