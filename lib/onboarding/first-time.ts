const COMPLETE_KEY = "handled_guided_onboarding_v2_complete";
const LEGACY_COMPLETE_KEY = "handled_first_onboarding_complete_v1";

function userCompleteKey(userId: string): string {
  return `${COMPLETE_KEY}_${userId}`;
}

function hasAnyUserSpecificCompletion(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${COMPLETE_KEY}_`)) return true;
    }
  } catch {
    /* private mode */
  }
  return false;
}

function readLegacyGlobalComplete(): boolean {
  try {
    return (
      localStorage.getItem(COMPLETE_KEY) === "1" ||
      localStorage.getItem(LEGACY_COMPLETE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function clearFirstOnboardingComplete(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.removeItem(userCompleteKey(userId));
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${COMPLETE_KEY}_`)) keysToRemove.push(key);
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem(COMPLETE_KEY);
    localStorage.removeItem(LEGACY_COMPLETE_KEY);
  } catch {
    /* private mode */
  }
}

/** When userId is known, completion is scoped per account (not browser-wide). */
export function isFirstOnboardingComplete(userId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (userId) {
      if (localStorage.getItem(userCompleteKey(userId)) === "1") return true;
      // Legacy global flag only applies before any per-user keys existed.
      if (!hasAnyUserSpecificCompletion()) {
        return readLegacyGlobalComplete();
      }
      return false;
    }
    return readLegacyGlobalComplete();
  } catch {
    return false;
  }
}

export function markFirstOnboardingComplete(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(userCompleteKey(userId), "1");
    localStorage.removeItem(COMPLETE_KEY);
    localStorage.removeItem(LEGACY_COMPLETE_KEY);
    window.dispatchEvent(new Event("handled-first-onboarding-complete"));
  } catch {
    /* private mode */
  }
}

export const FIRST_ONBOARDING_COMPLETE_EVENT = "handled-first-onboarding-complete";
