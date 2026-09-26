"use client";

import { Building2, CreditCard, LayoutGrid, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth-context";

const tabs = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/wallet", label: "Wallet", icon: WalletCards },
  { href: "/outlets", label: "Outlets", icon: Building2 },
  { href: "/account", label: "Account", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { merchant } = useAuth();
  const visibleTabs = merchant?.member_role === "cashier" ? tabs.filter((tab) => tab.href !== "/wallet") : tabs;
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-faint)] bg-[rgb(var(--surface))] pb-[env(safe-area-inset-bottom)]">
    <ul className="mx-auto flex max-w-xl">{visibleTabs.map((tab) => {
      const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
      const Icon = tab.icon;
      return <li key={tab.href} className="flex-1"><Link href={tab.href} className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? "text-gold" : "text-ink-500"}`}><Icon className="h-5 w-5"/><span>{tab.label}</span></Link></li>;
    })}</ul>
  </nav>;
}
