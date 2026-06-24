"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthResolution } from "@/app/auth-resolution-context";
import { commitClientRedirect } from "@/lib/auth/client-redirect-lock";
import {
  logPostAuthRoute,
  resolveAppRouteGuard,
} from "@/lib/auth/decide-next-route";

/** Redirect between /onboarding and app routes based on onboarding completion only. */
export function useOnboardingRouteGuard(): void {
  const pathname = usePathname();
  const { authStatus } = useAuthResolution();

  useLayoutEffect(() => {
    if (authStatus === "loading") return;
    const redirect = resolveAppRouteGuard(pathname, authStatus);
    if (!redirect) return;
    if (!commitClientRedirect("onboarding_route_guard", redirect)) return;

    logPostAuthRoute("onboarding_route_guard_navigate", {
      from: pathname,
      finalRoute: redirect,
      authStatus,
    });
    window.location.replace(redirect);
  }, [pathname, authStatus]);
}
