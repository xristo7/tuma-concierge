"use client";

import { Briefcase, Navigation, User, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Jobs", icon: Briefcase },
  { href: "/active", label: "Active", icon: Navigation },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/account", label: "Account", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-faint)] bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" || pathname.startsWith("/jobs") : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-gold" : "text-ink-500"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
