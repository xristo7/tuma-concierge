"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";

const PUBLIC_PATHS = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin && !isPublic) router.replace("/login");
    if (isAdmin && isPublic) router.replace("/");
  }, [ready, isAdmin, isPublic, router]);

  if (!ready) return null;
  if (!isAdmin && !isPublic) return null;
  if (isAdmin && isPublic) return null;

  return <>{children}</>;
}
