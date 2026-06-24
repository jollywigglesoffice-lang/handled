import { logAuthTransition } from "@/lib/auth/auth-resolution";
import type { AuthStatus } from "@/lib/auth/auth-resolution";
import { completeBootAfterAuth } from "@/lib/auth/boot-controller";
import { isFirstOnboardingComplete } from "@/lib/onboarding/first-time";
import {
  hasOnboardingResetPending,
  tryApplyOnboardingReset,
} from "@/lib/onboarding/reset";

export const ONBOARDING_PATH = "/onboarding";
export const INBOX_PATH = "/emails";

const ONBOARDING_GATED_PREFIXES = ["/emails", "/inbox", "/settings", "/app"] as const;

function sanitizeInternalPath(path?: string | null): string | null {
  if (!path?.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  return path;
}

export function isOnboardingGatedPath(pathname: string): boolean {
  return ONBOARDING_GATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isOnboardingRoute(pathname: string): boolean {
  return pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
}

export function shouldRequireOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  if (hasOnboardingResetPending()) return true;
  return !isFirstOnboardingComplete();
}

export function syncOnboardingCompletionState(): boolean {
  if (typeof window === "undefined") return false;
  tryApplyOnboardingReset();
  return isFirstOnboardingComplete();
}

/** Mandatory post-auth routing log — always emitted. */
export function logPostAuthRoute(
  event: string,
  detail: Record<string, unknown>,
): void {
  const payload = {
    event,
    ...detail,
    at: Date.now(),
  };
  console.log("[post-auth-route]", payload);
  logAuthTransition("post_auth_route", payload);
}

/**
 * Single post-auth routing decision.
 * onboardingCompleted === false → /onboarding
 * onboardingCompleted === true  → /emails (or safe requestedNext)
 */
export function decideNextRoute(requestedNext?: string | null): string {
  const resetPending = hasOnboardingResetPending();
  tryApplyOnboardingReset();
  const onboardingComplete = isFirstOnboardingComplete();

  let finalRoute: string;
  let reason: string;

  if (!onboardingComplete) {
    finalRoute = ONBOARDING_PATH;
    reason = "onboarding_incomplete";
  } else {
    const safe = sanitizeInternalPath(requestedNext) ?? INBOX_PATH;
    if (isOnboardingRoute(safe)) {
      finalRoute = INBOX_PATH;
      reason = "onboarding_already_complete";
    } else {
      finalRoute = safe;
      reason = "onboarding_complete";
    }
  }

  logPostAuthRoute("decide_next_route", {
    requestedNext: requestedNext ?? null,
    resetPending,
    onboardingComplete,
    onboardingRequired: !onboardingComplete,
    finalRoute,
    reason,
  });

  return finalRoute;
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
): string | null {
  if (authStatus === "loading") return null;

  const resetPending = hasOnboardingResetPending();
  tryApplyOnboardingReset();
  const onboardingComplete = isFirstOnboardingComplete();
  const requireOnboarding = !onboardingComplete;

  logPostAuthRoute("app_route_guard", {
    pathname,
    authStatus,
    resetPending,
    onboardingComplete,
    requireOnboarding,
  });

  if (authStatus === "unauthenticated") {
    logPostAuthRoute("app_route_guard_allow", { pathname, reason: "unauthenticated" });
    return null;
  }

  if (isOnboardingGatedPath(pathname) && requireOnboarding) {
    logPostAuthRoute("app_route_guard_redirect", {
      pathname,
      finalRoute: ONBOARDING_PATH,
      reason: "onboarding_required",
    });
    return ONBOARDING_PATH;
  }

  if (isOnboardingRoute(pathname) && onboardingComplete && !resetPending) {
    logPostAuthRoute("app_route_guard_redirect", {
      pathname,
      finalRoute: INBOX_PATH,
      reason: "onboarding_already_complete",
    });
    return INBOX_PATH;
  }

  logPostAuthRoute("app_route_guard_allow", { pathname, reason: "route_ok" });
  return null;
}

/** @deprecated Use decideNextRoute */
export function resolvePostAuthPath(requestedNext?: string | null): string {
  return decideNextRoute(requestedNext);
}

export function logPostLoginRouteDecision(input: {
  authStatus: AuthStatus;
  requestedNext?: string | null;
  destination: string;
}): void {
  logPostAuthRoute("post_login_route", {
    authStatus: input.authStatus,
    requestedNext: input.requestedNext ?? null,
    destination: input.destination,
    onboardingComplete: isFirstOnboardingComplete(),
    requireOnboarding: shouldRequireOnboarding(),
  });
}
