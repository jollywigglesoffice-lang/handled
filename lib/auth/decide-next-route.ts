import type { AuthStatus } from "@/lib/auth/auth-resolution";
import { completeBootAfterAuth } from "@/lib/auth/boot-controller";
import {
  logPostAuthRoute,
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

export function shouldRequireOnboarding(_userId?: string | null): boolean {
  return false;
}

export function syncOnboardingCompletionState(userId?: string | null): boolean {
  if (!userId) return false;
  return false;
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
  completeBootAfterAuth(requestedNext);
}

/**
 * App-shell guard — returns redirect target or null to stay on current path.
 */
export function resolveAppRouteGuard(
  pathname: string,
  authStatus: AuthStatus,
  _userId?: string | null,
): string | null {
  logPostAuthRoute("app_route_guard_allow", {
    pathname,
    authStatus,
    reason: "emergency_no_client_redirects",
  });
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
    onboardingDisabled: true,
    requireOnboarding: false,
  });
}
