import { logAuthTransition } from "@/lib/auth/auth-resolution";
import {
  destinationForOnboardingCompleted,
  INBOX_PATH,
  ONBOARDING_PATH,
} from "@/lib/onboarding/post-auth-gate";

export { INBOX_PATH, ONBOARDING_PATH };

const ONBOARDING_GATED_PREFIXES = ["/emails", "/inbox", "/settings", "/app"] as const;

export type ResolveStartRouteInput = {
  requestedNext?: string | null;
  userId?: string | null;
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

export function resolveStartRoute(input: ResolveStartRouteInput = {}): string {
  const onboardingComplete = input.onboardingComplete === true;
  const safe = sanitizeInternalPath(input.requestedNext);
  const finalRoute = onboardingComplete
    ? (isOnboardingRoute(safe ?? "") ? INBOX_PATH : (safe ?? INBOX_PATH))
    : ONBOARDING_PATH;

  logPostAuthRoute("resolve_start_route", {
    userId: input.userId ?? null,
    requestedNext: input.requestedNext ?? null,
    onboardingComplete,
    finalRoute,
    reason: onboardingComplete ? "onboarding_complete" : "onboarding_incomplete",
  });

  return finalRoute;
}

export function resolveStartRouteFromFlag(onboardingCompleted: boolean): string {
  return destinationForOnboardingCompleted(onboardingCompleted);
}
