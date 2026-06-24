import { logAuthTransition } from "@/lib/auth/auth-resolution";
import type { AuthStatus } from "@/lib/auth/auth-resolution";
import { isFirstOnboardingComplete } from "@/lib/onboarding/first-time";
import {
  hasOnboardingResetPending,
  tryApplyOnboardingReset,
} from "@/lib/onboarding/reset";

export const ONBOARDING_PATH = "/onboarding";
export const INBOX_PATH = "/emails";

const ONBOARDING_GATED_PREFIXES = ["/emails", "/inbox", "/settings", "/app"] as const;

function isOnboardingDebugEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ONBOARDING_DEBUG === "1" ||
    process.env.NEXT_PUBLIC_AUTH_DEBUG === "1"
  );
}

export function logOnboardingRouteDecision(
  detail: Record<string, unknown> & { decision?: string },
): void {
  if (!isOnboardingDebugEnabled()) return;
  console.log("[onboarding-route]", { ...detail, at: Date.now() });
}

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

/**
 * Single source of truth for whether the user must complete onboarding.
 * Depends ONLY on onboarding completion (+ pending reset), never auth alone.
 */
export function shouldRequireOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  if (hasOnboardingResetPending()) return true;
  return !isFirstOnboardingComplete();
}

/** Apply pending reset, then read completion flag. */
export function syncOnboardingCompletionState(): boolean {
  if (typeof window === "undefined") return false;
  tryApplyOnboardingReset();
  return isFirstOnboardingComplete();
}

/**
 * Post-auth destination: onboarding first when incomplete, otherwise inbox (or safe next).
 */
export function resolvePostAuthPath(requestedNext?: string | null): string {
  const resetPending = hasOnboardingResetPending();
  tryApplyOnboardingReset();
  const onboardingComplete = isFirstOnboardingComplete();

  logOnboardingRouteDecision({
    context: "post_auth",
    requestedNext,
    resetPending,
    onboardingComplete,
    requireOnboarding: !onboardingComplete,
  });

  if (!onboardingComplete) {
    logOnboardingRouteDecision({
      decision: `redirect:${ONBOARDING_PATH}`,
      reason: "onboarding_incomplete",
    });
    return ONBOARDING_PATH;
  }

  const safe = sanitizeInternalPath(requestedNext) ?? INBOX_PATH;
  if (isOnboardingRoute(safe)) {
    logOnboardingRouteDecision({
      decision: `redirect:${INBOX_PATH}`,
      reason: "onboarding_already_complete",
    });
    return INBOX_PATH;
  }

  logOnboardingRouteDecision({
    decision: `redirect:${safe}`,
    reason: "onboarding_complete",
  });
  return safe;
}

/**
 * Client route guard after auth is known.
 * Returns a redirect target or null to stay on the current path.
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

  logOnboardingRouteDecision({
    context: "app_route_guard",
    pathname,
    authStatus,
    resetPending,
    onboardingComplete,
    requireOnboarding,
  });

  if (authStatus === "unauthenticated") {
    logOnboardingRouteDecision({ decision: "allow", reason: "unauthenticated_middleware_handles" });
    return null;
  }

  if (isOnboardingGatedPath(pathname) && requireOnboarding) {
    logOnboardingRouteDecision({
      decision: `redirect:${ONBOARDING_PATH}`,
      reason: "onboarding_required",
    });
    return ONBOARDING_PATH;
  }

  if (isOnboardingRoute(pathname) && onboardingComplete && !resetPending) {
    logOnboardingRouteDecision({
      decision: `redirect:${INBOX_PATH}`,
      reason: "onboarding_already_complete",
    });
    return INBOX_PATH;
  }

  logOnboardingRouteDecision({ decision: "allow", reason: "route_ok" });
  return null;
}

/** Structured log tying auth + onboarding for post-login debugging. */
export function logPostLoginRouteDecision(input: {
  authStatus: AuthStatus;
  requestedNext?: string | null;
  destination: string;
}): void {
  logAuthTransition("post_login_route", {
    authStatus: input.authStatus,
    requestedNext: input.requestedNext ?? null,
    onboardingComplete: isFirstOnboardingComplete(),
    requireOnboarding: shouldRequireOnboarding(),
    destination: input.destination,
  });
  logOnboardingRouteDecision({
    context: "post_login",
    authStatus: input.authStatus,
    requestedNext: input.requestedNext ?? null,
    destination: input.destination,
    onboardingComplete: isFirstOnboardingComplete(),
  });
}
