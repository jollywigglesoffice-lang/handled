import type { AuthStatus } from "@/lib/auth/auth-resolution";
import { completeBootAfterAuth } from "@/lib/auth/boot-controller";
import { isFirstOnboardingComplete } from "@/lib/onboarding/first-time";
import {
  hasOnboardingResetPending,
  tryApplyOnboardingReset,
} from "@/lib/onboarding/reset";
import {
  INBOX_PATH,
  isOnboardingGatedPath,
  isOnboardingRoute,
  logPostAuthRoute,
  ONBOARDING_PATH,
  resolveStartRoute,
} from "@/lib/auth/resolve-start-route";

export {
  INBOX_PATH,
  isOnboardingGatedPath,
  isOnboardingRoute,
  logPostAuthRoute,
  ONBOARDING_PATH,
  resolveStartRoute,
  type ResolveStartRouteInput,
} from "@/lib/auth/resolve-start-route";

export function shouldRequireOnboarding(userId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  if (hasOnboardingResetPending()) return true;
  return !isFirstOnboardingComplete(userId);
}

export function syncOnboardingCompletionState(userId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  tryApplyOnboardingReset();
  return isFirstOnboardingComplete(userId);
}

/** @deprecated Use resolveStartRoute */
export function decideNextRoute(
  requestedNext?: string | null,
  userId?: string | null,
): string {
  return resolveStartRoute({ requestedNext, userId });
}

/**
 * @deprecated Use completeBootAfterAuth from @/lib/auth/boot-controller.
 */
export function navigateAfterAuthSuccess(
  requestedNext?: string | null,
  source = "post_auth_navigate",
): void {
  logPostAuthRoute("auth_success_deprecated", {
    source,
    requestedNext: requestedNext ?? null,
    message: "Use completeBootAfterAuth instead",
  });
  void completeBootAfterAuth(requestedNext);
}

/**
 * App-shell guard — returns redirect target or null to stay on current path.
 */
export function resolveAppRouteGuard(
  pathname: string,
  authStatus: AuthStatus,
  userId?: string | null,
): string | null {
  if (authStatus === "loading") return null;

  if (authStatus === "unauthenticated") {
    logPostAuthRoute("app_route_guard_allow", { pathname, reason: "unauthenticated" });
    return null;
  }

  const startRoute = resolveStartRoute({ userId });

  logPostAuthRoute("app_route_guard", {
    pathname,
    authStatus,
    userId: userId ?? null,
    startRoute,
    onboardingComplete: isFirstOnboardingComplete(userId),
  });

  if (isOnboardingGatedPath(pathname) && startRoute === ONBOARDING_PATH) {
    logPostAuthRoute("app_route_guard_redirect", {
      pathname,
      finalRoute: ONBOARDING_PATH,
      reason: "onboarding_required",
    });
    return ONBOARDING_PATH;
  }

  if (isOnboardingRoute(pathname) && startRoute !== ONBOARDING_PATH) {
    logPostAuthRoute("app_route_guard_redirect", {
      pathname,
      finalRoute: startRoute,
      reason: "onboarding_already_complete",
    });
    return startRoute;
  }

  logPostAuthRoute("app_route_guard_allow", { pathname, reason: "route_ok" });
  return null;
}

/** @deprecated Use resolveStartRoute */
export function resolvePostAuthPath(requestedNext?: string | null): string {
  return resolveStartRoute({ requestedNext });
}

export function logPostLoginRouteDecision(input: {
  authStatus: AuthStatus;
  userId?: string | null;
  requestedNext?: string | null;
  destination: string;
}): void {
  logPostAuthRoute("post_login_route", {
    authStatus: input.authStatus,
    userId: input.userId ?? null,
    requestedNext: input.requestedNext ?? null,
    destination: input.destination,
    onboardingComplete: isFirstOnboardingComplete(input.userId),
    requireOnboarding: shouldRequireOnboarding(input.userId),
  });
}
