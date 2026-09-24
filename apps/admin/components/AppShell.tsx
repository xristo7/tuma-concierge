"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";
import { NavDrawer } from "./NavDrawer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/set-password";
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AuthGate>
      {!isAuthPage && <BrandHeader onMenuClick={() => setDrawerOpen(true)} />}
      {!isAuthPage && <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
      <main className="mx-auto min-h-dvh max-w-lg pb-20">{children}</main>
      {!isAuthPage && <BottomNav />}
    </AuthGate>
  );
}
