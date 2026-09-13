"use client";

import { isRiderProfileComplete } from "@tuma/shared";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";

const PUBLIC_PATHS = ["/login"];
// Always reachable for a signed-in rider, even with an incomplete profile —
// otherwise they could never get to the form that completes it.
const ALWAYS_ALLOWED_PATHS = ["/account"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready, rider, riderReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const needsProfile =
    !!user && user.role === "rider" && riderReady && !isRiderProfileComplete(rider) && !ALWAYS_ALLOWED_PATHS.includes(pathname);

  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
    if (user && needsProfile) router.replace("/account");
  }, [ready, user, isPublic, needsProfile, router]);

  if (!ready) return null;
  if (!user && !isPublic) return null;
  if (user && isPublic) return null;
  if (user && needsProfile) return null;

  return <>{children}</>;
}
