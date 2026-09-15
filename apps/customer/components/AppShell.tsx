"use client";

import { usePathname } from "next/navigation";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/forgot-password" || pathname.startsWith("/verify");
  const isFullScreenPage = pathname === "/chat";

  return (
    <AuthGate>
      {!isAuthPage && !isFullScreenPage && <BrandHeader />}
      <main className={isFullScreenPage ? "" : "mx-auto min-h-dvh max-w-lg pb-20"}>{children}</main>
      {!isAuthPage && !isFullScreenPage && <BottomNav />}
    </AuthGate>
  );
}
