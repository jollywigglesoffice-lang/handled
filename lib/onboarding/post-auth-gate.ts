import {
  loadOnboardingCompletedForUser,
  normalizeOnboardingCompleted,
} from "@/lib/onboarding/completion-store";

export const INBOX_PATH = "/emails";
export const ONBOARDING_PATH = "/onboarding";

/** true → inbox; false/null/undefined → onboarding */
export function destinationForOnboardingCompleted(onboardingCompleted: boolean): string {
  return onboardingCompleted ? INBOX_PATH : ONBOARDING_PATH;
}

export async function resolvePostAuthDestinationForUser(
  userId: string,
): Promise<{ destination: string; onboardingCompleted: boolean }> {
  const loaded = await loadOnboardingCompletedForUser(userId);
  return {
    onboardingCompleted: loaded.completed,
    destination: destinationForOnboardingCompleted(loaded.completed),
  };
}

export type OnboardingGateStatus = {
  authenticated: boolean;
  onboardingCompleted: boolean;
  source: string;
};

/** Single API read — source of truth for client gate (after auth is already resolved). */
export async function fetchOnboardingGateStatus(): Promise<OnboardingGateStatus> {
  try {
    const res = await fetch("/api/onboarding/status", {
      credentials: "include",
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      authenticated?: boolean;
      onboardingCompleted?: unknown;
      source?: string;
    };
    return {
      authenticated: body.authenticated === true,
      onboardingCompleted: normalizeOnboardingCompleted(body.onboardingCompleted),
      source: body.source ?? (res.ok ? "api" : "api_error"),
    };
  } catch {
    return {
      authenticated: false,
      onboardingCompleted: false,
      source: "fetch_error",
    };
  }
}

let gateRedirectCommitted = false;

/** One redirect per full page load — prevents loops. */
export function redirectOnceToDestination(destination: string, reason: string): boolean {
  if (gateRedirectCommitted) return false;
  if (typeof window === "undefined") return false;
  if (window.location.pathname === destination.split("?")[0]) return false;

  gateRedirectCommitted = true;
  console.log("[onboarding-gate] redirect", { destination, reason, at: Date.now() });
  window.location.replace(destination);
  return true;
}

export function resetOnboardingGateRedirectLock(): void {
  gateRedirectCommitted = false;
}

export async function redirectAfterAuthenticatedLogin(reason: string): Promise<void> {
  const status = await fetchOnboardingGateStatus();
  const destination = destinationForOnboardingCompleted(status.onboardingCompleted);
  redirectOnceToDestination(destination, reason);
}
