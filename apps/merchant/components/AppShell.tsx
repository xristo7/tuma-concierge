"use client";

import { Store } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { merchant } = useAuth();
  const bare = pathname === "/login" || pathname === "/apply";
  return <AuthGate>
    {!bare && <header className="sticky top-0 z-30 border-b border-[var(--border-faint)] bg-[rgb(var(--surface))]/95 backdrop-blur"><div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold text-ink-gold"><Store className="h-4 w-4"/></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-navy">Tuma Merchant</p><p className="max-w-[240px] truncate text-[10px] text-ink-500">{merchant?.display_name}</p></div>{merchant?.environment === "sandbox" && <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-sky-700">Sandbox</span>}</div></header>}
    <main className={`mx-auto min-h-dvh max-w-xl ${bare ? "" : "pb-20"}`}>{children}</main>
    {!bare && <BottomNav />}
  </AuthGate>;
}
