"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";

const PUBLIC_PATHS = ["/login"];
// Reachable even while a forced password change is pending — otherwise
// there'd be no way to actually clear it. Matches the API's own allowlist
// in requireAuth (see apps/api/src/auth/middleware.ts): everywhere else
// would just 403 anyway, so there's nothing else worth leaving reachable.
const ALWAYS_ALLOWED_PATHS = ["/set-password"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAdmin = user?.role === "admin";
  const needsPasswordChange = isAdmin && !!user?.forcePasswordChange && !ALWAYS_ALLOWED_PATHS.includes(pathname);

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin && !isPublic) router.replace("/login");
    if (isAdmin && isPublic) router.replace("/");
    if (needsPasswordChange) router.replace("/set-password");
  }, [ready, isAdmin, isPublic, needsPasswordChange, router]);

  if (!ready) return null;
  if (!isAdmin && !isPublic) return null;
  if (isAdmin && isPublic) return null;
  if (needsPasswordChange) return null;

  return <>{children}</>;
}
