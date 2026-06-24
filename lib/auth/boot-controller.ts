import {
  logAuthTransition,
  resolveClientAuth,
  type AuthResolutionResult,
  type AuthStatus,
} from "@/lib/auth/auth-resolution";
import {
  isOnboardingGatedPath,
  isOnboardingRoute,
  logPostAuthRoute,
  ONBOARDING_PATH,
  resolveStartRoute,
} from "@/lib/auth/resolve-start-route";
import {
  hasOnboardingResetPending,
  tryApplyOnboardingReset,
} from "@/lib/onboarding/reset";
import { isFirstOnboardingComplete } from "@/lib/onboarding/first-time";

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
let navigationCommitted = false;

function resolveOnboardingState(userId: string | null): {
  onboardingComplete: boolean;
  requireOnboarding: boolean;
  resetPending: boolean;
} {
  const resetPending = hasOnboardingResetPending();
  tryApplyOnboardingReset();
  const onboardingComplete = isFirstOnboardingComplete(userId);
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
  requestedNext?: string | null;
}): string | null {
  const { mode, pathname, auth, requestedNext } = input;

  if (auth.status === "unauthenticated") {
    if (mode === "app") {
      return `/login?next=${encodeURIComponent(pathname)}`;
    }
    return null;
  }

  const startRoute = resolveStartRoute({
    requestedNext,
    userId: auth.userId,
  });

  if (mode === "login" || mode === "callback") {
    return startRoute;
  }

  if (isOnboardingGatedPath(pathname) && startRoute === ONBOARDING_PATH) {
    return ONBOARDING_PATH;
  }

  if (isOnboardingRoute(pathname) && startRoute !== ONBOARDING_PATH) {
    return startRoute;
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
    userId: snapshot.userId,
    onboardingComplete: snapshot.onboardingComplete,
    requireOnboarding: snapshot.requireOnboarding,
    destination: snapshot.destination,
    finalRoute: snapshot.destination,
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
 * 1. resolve auth  2. resolveStartRoute  3. lock
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
    const onboarding = resolveOnboardingState(auth.userId);
    const destination = computeDestination({
      mode: input.mode,
      pathname: input.pathname,
      auth,
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

/**
 * Single navigation gate — the only place allowed to navigate after
 * resolveStartRoute() has chosen a destination.
 */
export function commitPostAuthRouteDecision(snapshot: BootSnapshot): boolean {
  const finalRoute = snapshot.destination ?? snapshot.pathname;
  const willNavigate = Boolean(
    snapshot.destination && snapshot.destination !== snapshot.pathname,
  );

  const payload = {
    from: snapshot.pathname,
    finalRoute,
    userId: snapshot.userId,
    onboardingComplete: snapshot.onboardingComplete,
    navigated: willNavigate,
    at: Date.now(),
  };

  console.log("POST_AUTH_ROUTE_DECISION_EXECUTED", payload);
  logPostAuthRoute("POST_AUTH_ROUTE_DECISION_EXECUTED", payload);

  if (!willNavigate || !snapshot.destination) {
    return false;
  }

  if (navigationCommitted) {
    logPostAuthRoute("boot_navigate_blocked", {
      target: snapshot.destination,
      reason: "navigation_already_committed",
    });
    return false;
  }

  navigationCommitted = true;
  lockedSnapshot = { ...snapshot, phase: "navigating", ready: false };

  window.location.replace(snapshot.destination);
  return true;
}

/** @deprecated Use commitPostAuthRouteDecision */
export function executeBootNavigation(snapshot: BootSnapshot): boolean {
  return commitPostAuthRouteDecision(snapshot);
}

/** Post-OAuth / post-password — fresh boot then navigate once via resolveStartRoute. */
export async function completeBootAfterAuth(
  requestedNext?: string | null,
): Promise<void> {
  resetBootLock();

  logPostAuthRoute("auth_success", {
    requestedNext: requestedNext ?? null,
  });

  const snapshot = await runBoot({
    pathname: window.location.pathname,
    mode: "callback",
    requestedNext,
  });

  commitPostAuthRouteDecision(snapshot);
}

/** After onboarding is marked complete — route via resolveStartRoute only. */
export async function completeBootAfterOnboarding(
  requestedNext?: string | null,
): Promise<void> {
  resetBootLock();
  const snapshot = await runBoot({
    pathname: window.location.pathname,
    mode: "callback",
    requestedNext,
  });
  commitPostAuthRouteDecision(snapshot);
}
