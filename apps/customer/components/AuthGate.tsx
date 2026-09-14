"use client";

import { isUserVerified } from "@tuma/shared";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";

const PUBLIC_PATHS = ["/login"];
// Always reachable for a signed-in but not-yet-verified customer —
// otherwise they could never get to the screen that verifies them.
const ALWAYS_ALLOWED_PATHS = ["/verify"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const needsVerification = !!user && !isUserVerified(user) && !ALWAYS_ALLOWED_PATHS.includes(pathname);
  const verifiedButOnVerifyPage = !!user && isUserVerified(user) && pathname === "/verify";

  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
    if (user && needsVerification) router.replace("/verify");
    if (verifiedButOnVerifyPage) router.replace("/");
  }, [ready, user, isPublic, needsVerification, verifiedButOnVerifyPage, router]);

  if (!ready) return null;
  if (!user && !isPublic) return null;
  if (user && isPublic) return null;
  if (user && needsVerification) return null;
  if (verifiedButOnVerifyPage) return null;

  return <>{children}</>;
}
