import {
  logAuthTransition,
  resolveClientAuth,
  type AuthResolutionResult,
  type AuthStatus,
} from "@/lib/auth/auth-resolution";
import { getPostLoginDestination, redirectToInboxAfterLogin } from "@/lib/auth/post-login-destination";

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

/**
 * Resolve auth once per page load — NO routing decisions, NO redirects.
 * Middleware handles unauthenticated access to app paths.
 */
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

/** Password login — one redirect to inbox. OAuth uses server callback redirect. */
export function completeBootAfterAuth(_requestedNext?: string | null): void {
  resetBootLock();
  redirectToInboxAfterLogin();
}

/** @deprecated Emergency mode — same as completeBootAfterAuth */
export function completeBootAfterOnboarding(_requestedNext?: string | null): void {
  completeBootAfterAuth();
}

/** @deprecated No client routing in emergency mode */
export function commitPostAuthRouteDecision(): boolean {
  return false;
}

/** @deprecated No client routing in emergency mode */
export function executeBootNavigation(): boolean {
  return false;
}

export function getPostLoginPath(): string {
  return getPostLoginDestination();
}
