"use client";

import { isRiderProfileComplete, isUserVerified } from "@tuma/shared";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";

const PUBLIC_PATHS = ["/login"];
// Always reachable for a signed-in rider even before they're fully set up —
// otherwise they could never reach the screens that get them there.
const ALWAYS_ALLOWED_PATHS = ["/account", "/verify"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready, rider, riderReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const needsVerification = !!user && !isUserVerified(user) && pathname !== "/verify";
  // Verification comes first — profile completion is checked only once
  // they're through it, so /account doesn't fire ahead of /verify.
  const needsProfile =
    !!user &&
    user.role === "rider" &&
    isUserVerified(user) &&
    riderReady &&
    !isRiderProfileComplete(rider) &&
    !ALWAYS_ALLOWED_PATHS.includes(pathname);
  const verifiedButOnVerifyPage = !!user && isUserVerified(user) && pathname === "/verify";

  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
    if (user && needsVerification) router.replace("/verify");
    if (verifiedButOnVerifyPage) router.replace("/");
    if (user && needsProfile) router.replace("/account");
  }, [ready, user, isPublic, needsVerification, verifiedButOnVerifyPage, needsProfile, router]);

  if (!ready) return null;
  if (!user && !isPublic) return null;
  if (user && isPublic) return null;
  if (user && needsVerification) return null;
  if (verifiedButOnVerifyPage) return null;
  if (user && needsProfile) return null;

  return <>{children}</>;
}
