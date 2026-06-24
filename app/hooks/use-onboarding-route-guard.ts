"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthResolution } from "@/app/auth-resolution-context";
import { commitClientRedirect } from "@/lib/auth/client-redirect-lock";
import {
  logOnboardingRouteDecision,
  resolveAppRouteGuard,
} from "@/lib/onboarding/route-access";

/** Redirect between /onboarding and app routes based on onboarding completion only. */
export function useOnboardingRouteGuard(): void {
  const pathname = usePathname();
  const { authStatus } = useAuthResolution();

  useEffect(() => {
    if (authStatus === "loading") return;
    const redirect = resolveAppRouteGuard(pathname, authStatus);
    if (!redirect) return;
    if (!commitClientRedirect("onboarding_route_guard", redirect)) return;

    logOnboardingRouteDecision({
      context: "use_onboarding_route_guard",
      from: pathname,
      redirect,
      authStatus,
    });
    window.location.replace(redirect);
  }, [pathname, authStatus]);
}
