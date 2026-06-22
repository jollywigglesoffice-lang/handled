import { logAuthTransition } from "@/lib/auth/auth-resolution";

let redirectCommitted = false;

/** Allow at most one client-side navigation decision per full page load. */
export function commitClientRedirect(source: string, target: string): boolean {
  if (redirectCommitted) {
    logAuthTransition("redirect_blocked", {
      source,
      target,
      reason: "redirect_lock",
    });
    return false;
  }
  redirectCommitted = true;
  logAuthTransition("redirect_commit", { source, target });
  return true;
}

export function isClientRedirectCommitted(): boolean {
  return redirectCommitted;
}

/** Test-only reset — not exported in production paths. */
export function resetClientRedirectLockForTests(): void {
  redirectCommitted = false;
}
