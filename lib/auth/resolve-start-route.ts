import { logAuthTransition } from "@/lib/auth/auth-resolution";

export const ONBOARDING_PATH = "/onboarding";
export const INBOX_PATH = "/emails";

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

export function resolveStartRoute(input: ResolveStartRouteInput = {}): string {
  const safe = sanitizeInternalPath(input.requestedNext) ?? INBOX_PATH;
  const finalRoute = isOnboardingRoute(safe) ? INBOX_PATH : safe;

  logPostAuthRoute("resolve_start_route", {
    userId: input.userId ?? null,
    requestedNext: input.requestedNext ?? null,
    finalRoute,
    reason: "emergency_inbox_only",
    onboardingDisabled: true,
  });

  return finalRoute;
}
