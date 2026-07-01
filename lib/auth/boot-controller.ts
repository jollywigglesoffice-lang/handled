import {
  logAuthTransition,
  resolveClientAuth,
  type AuthResolutionResult,
  type AuthStatus,
} from "@/lib/auth/auth-resolution";
import { redirectAfterAuthenticatedLogin, INBOX_PATH, redirectOnceToDestination } from "@/lib/onboarding/post-auth-gate";

export type BootMode = "app" | "login";

export type BootSnapshot = {
  authStatus: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  ready: boolean;
};

type BootInput = {
  mode: BootMode;
};

let bootPromise: Promise<BootSnapshot> | null = null;
let lockedSnapshot: BootSnapshot | null = null;

function buildSnapshot(auth: AuthResolutionResult): BootSnapshot {
  return {
    authStatus: auth.status,
    userId: auth.userId,
    userEmail: auth.email,
    ready: true,
  };
}

/** Resolve auth once per page load — NO routing decisions, NO redirects. */
export async function runBoot(_input: BootInput): Promise<BootSnapshot> {
  if (lockedSnapshot) {
    return lockedSnapshot;
  }
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    const auth = await resolveClientAuth("boot");
    const snapshot = buildSnapshot(auth);
    lockedSnapshot = snapshot;
    bootPromise = null;
    logAuthTransition("boot_complete", {
      authStatus: snapshot.authStatus,
      userId: snapshot.userId,
    });
    return snapshot;
  })();

  return bootPromise;
}

export function resetBootLock(): void {
  lockedSnapshot = null;
  bootPromise = null;
}

export function resetBootForSignOut(): void {
  resetBootLock();
}

/** Password login — fetch profile once, redirect once. OAuth uses server callback. */
export async function completeBootAfterAuth(_requestedNext?: string | null): Promise<void> {
  resetBootLock();
  await redirectAfterAuthenticatedLogin("password_login");
}

/** After onboarding finished — go to inbox (completion already saved). */
export function completeBootAfterOnboarding(): void {
  resetBootLock();
  redirectOnceToDestination(INBOX_PATH, "onboarding_finished");
}

/** @deprecated No client boot routing */
export function commitPostAuthRouteDecision(): boolean {
  return false;
}

/** @deprecated No client boot routing */
export function executeBootNavigation(): boolean {
  return false;
}
