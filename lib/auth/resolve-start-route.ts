import { logAuthTransition } from "@/lib/auth/auth-resolution";
import { getOnboardingRuntimeEnvironment, logOnboardingCompletionState } from "@/lib/onboarding/completion-log";
import { isFirstOnboardingComplete } from "@/lib/onboarding/first-time";
import {
  hasOnboardingResetPending,
  tryApplyOnboardingReset,
} from "@/lib/onboarding/reset";

export const ONBOARDING_PATH = "/onboarding";
export const INBOX_PATH = "/emails";

const ONBOARDING_GATED_PREFIXES = ["/emails", "/inbox", "/settings", "/app"] as const;

export type ResolveStartRouteInput = {
  requestedNext?: string | null;
  userId?: string | null;
  /** When set (e.g. after server hydrate), skips cache read. */
  onboardingComplete?: boolean;
};

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
 * Single source of truth for the first authenticated screen.
 *
 * onboardingCompleted === false → /onboarding
 * onboardingCompleted === true  → /emails (or safe requestedNext)
 */
export function resolveStartRoute(input: ResolveStartRouteInput = {}): string {
  const requestedNext = input.requestedNext ?? null;
  const userId = input.userId ?? null;

  const resetPending = hasOnboardingResetPending();
  tryApplyOnboardingReset();
  const onboardingComplete =
    input.onboardingComplete !== undefined
      ? input.onboardingComplete === true
      : isFirstOnboardingComplete(userId);

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

  logPostAuthRoute("resolve_start_route", {
    userId,
    requestedNext,
    resetPending,
    onboardingComplete,
    onboardingRequired: !onboardingComplete,
    finalRoute,
    reason,
    environment: getOnboardingRuntimeEnvironment(),
  });

  logOnboardingCompletionState({
    scope: "boot",
    userId,
    onboardingCompleted: onboardingComplete,
    source: input.onboardingComplete !== undefined ? "boot_hydrated" : "cache_read",
    environment: getOnboardingRuntimeEnvironment(),
  });

  return finalRoute;
}
