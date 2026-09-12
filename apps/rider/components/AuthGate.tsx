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

  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
  }, [ready, user, isPublic, router]);

  if (!ready) return null;
  if (!user && !isPublic) return null;
  if (user && isPublic) return null;

  return <>{children}</>;
}
