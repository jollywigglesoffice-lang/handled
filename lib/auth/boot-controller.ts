import {
  logAuthTransition,
  resolveClientAuth,
  type AuthResolutionResult,
  type AuthStatus,
} from "@/lib/auth/auth-resolution";
import { isFirstOnboardingComplete } from "@/lib/onboarding/first-time";
import {
  decideNextRoute,
  INBOX_PATH,
  isOnboardingGatedPath,
  isOnboardingRoute,
  logPostAuthRoute,
  ONBOARDING_PATH,
} from "@/lib/auth/decide-next-route";
import {
  hasOnboardingResetPending,
  tryApplyOnboardingReset,
} from "@/lib/onboarding/reset";

export type BootMode = "app" | "login" | "callback";

export type BootPhase = "pending" | "running" | "locked" | "navigating";

export type BootSnapshot = {
  phase: BootPhase;
  authStatus: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  onboardingComplete: boolean;
  requireOnboarding: boolean;
  pathname: string;
  /** When set and different from pathname, boot requires one navigation. */
  destination: string | null;
  ready: boolean;
};

type BootInput = {
  pathname: string;
  mode: BootMode;
  requestedNext?: string | null;
};

let bootPromise: Promise<BootSnapshot> | null = null;
let lockedSnapshot: BootSnapshot | null = null;
let routeDecisionLocked = false;

function resolveOnboardingState(): {
  onboardingComplete: boolean;
  requireOnboarding: boolean;
  resetPending: boolean;
} {
  const resetPending = hasOnboardingResetPending();
  tryApplyOnboardingReset();
  const onboardingComplete = isFirstOnboardingComplete();
  return {
    onboardingComplete,
    requireOnboarding: !onboardingComplete,
    resetPending,
  };
}

function computeDestination(input: {
  mode: BootMode;
  pathname: string;
  auth: AuthResolutionResult;
  onboardingComplete: boolean;
  requireOnboarding: boolean;
  resetPending: boolean;
  requestedNext?: string | null;
}): string | null {
  const { mode, pathname, auth, requireOnboarding, resetPending, requestedNext } = input;

  if (auth.status === "unauthenticated") {
    if (mode === "app") {
      return `/login?next=${encodeURIComponent(pathname)}`;
    }
    return null;
  }

  if (mode === "login" || mode === "callback") {
    return decideNextRoute(requestedNext);
  }

  if (isOnboardingGatedPath(pathname) && requireOnboarding) {
    return ONBOARDING_PATH;
  }

  if (isOnboardingRoute(pathname) && input.onboardingComplete && !resetPending) {
    return INBOX_PATH;
  }

  return null;
}

function buildSnapshot(
  input: BootInput,
  auth: AuthResolutionResult,
  onboarding: ReturnType<typeof resolveOnboardingState>,
  destination: string | null,
  phase: BootPhase,
): BootSnapshot {
  return {
    phase,
    authStatus: auth.status,
    userId: auth.userId,
    userEmail: auth.email,
    onboardingComplete: onboarding.onboardingComplete,
    requireOnboarding: onboarding.requireOnboarding,
    pathname: input.pathname,
    destination,
    ready: phase === "locked" && (destination === null || destination === input.pathname),
  };
}

function logBootComplete(snapshot: BootSnapshot, input: BootInput): void {
  logPostAuthRoute("boot_complete", {
    mode: input.mode,
    pathname: input.pathname,
    authStatus: snapshot.authStatus,
    onboardingComplete: snapshot.onboardingComplete,
    requireOnboarding: snapshot.requireOnboarding,
    destination: snapshot.destination,
    ready: snapshot.ready,
    routeLocked: routeDecisionLocked,
  });
  logAuthTransition("boot_complete", {
    mode: input.mode,
    pathname: input.pathname,
    authStatus: snapshot.authStatus,
    onboardingComplete: snapshot.onboardingComplete,
    destination: snapshot.destination,
  });
}

/**
 * Deterministic boot — runs once per full page load.
 * 1. resolve auth  2. resolve onboarding  3. choose route  4. lock
 */
export async function runBoot(input: BootInput): Promise<BootSnapshot> {
  if (lockedSnapshot && lockedSnapshot.pathname !== input.pathname) {
    resetBootLock();
  }

  if (lockedSnapshot) {
    return lockedSnapshot;
  }
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    logPostAuthRoute("boot_start", {
      mode: input.mode,
      pathname: input.pathname,
      requestedNext: input.requestedNext ?? null,
    });

    const auth = await resolveClientAuth();
    const onboarding = resolveOnboardingState();
    const destination = computeDestination({
      mode: input.mode,
      pathname: input.pathname,
      auth,
      ...onboarding,
      requestedNext: input.requestedNext,
    });

    const snapshot = buildSnapshot(input, auth, onboarding, destination, "locked");
    lockedSnapshot = snapshot;
    routeDecisionLocked = true;
    bootPromise = null;

    logBootComplete(snapshot, input);
    return snapshot;
  })();

  return bootPromise;
}

export function isBootRouteLocked(): boolean {
  return routeDecisionLocked;
}

export function getLockedBootSnapshot(): BootSnapshot | null {
  return lockedSnapshot;
}

let navigationCommitted = false;

export function resetBootLock(): void {
  routeDecisionLocked = false;
  lockedSnapshot = null;
  bootPromise = null;
  navigationCommitted = false;
}

/** Clear boot lock on sign-out. */
export function resetBootForSignOut(): void {
  resetBootLock();
}

/** One navigation per page load after boot decision. */
export function executeBootNavigation(snapshot: BootSnapshot): boolean {
  const target = snapshot.destination;
  if (!target || target === snapshot.pathname) {
    return false;
  }
  if (navigationCommitted) {
    logPostAuthRoute("boot_navigate_blocked", {
      target,
      reason: "navigation_already_committed",
    });
    return false;
  }

  navigationCommitted = true;
  lockedSnapshot = { ...snapshot, phase: "navigating", ready: false };

  logPostAuthRoute("boot_navigate", {
    from: snapshot.pathname,
    finalRoute: target,
    authStatus: snapshot.authStatus,
    onboardingComplete: snapshot.onboardingComplete,
  });

  window.location.replace(target);
  return true;
}

/** Post-OAuth / post-password — fresh boot then navigate once. */
export async function completeBootAfterAuth(
  requestedNext?: string | null,
): Promise<void> {
  resetBootLock();
  const snapshot = await runBoot({
    pathname: window.location.pathname,
    mode: "callback",
    requestedNext,
  });
  executeBootNavigation(snapshot);
}
