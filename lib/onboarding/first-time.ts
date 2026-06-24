const COMPLETE_KEY = "handled_guided_onboarding_v2_complete";
const LEGACY_COMPLETE_KEY = "handled_first_onboarding_complete_v1";

export function clearFirstOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COMPLETE_KEY);
    localStorage.removeItem(LEGACY_COMPLETE_KEY);
  } catch {
    /* private mode */
  }
}

export function isFirstOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(COMPLETE_KEY) === "1" ||
      localStorage.getItem(LEGACY_COMPLETE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function markFirstOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPLETE_KEY, "1");
    window.dispatchEvent(new Event("handled-first-onboarding-complete"));
  } catch {
    /* private mode */
  }
}

export const FIRST_ONBOARDING_COMPLETE_EVENT = "handled-first-onboarding-complete";
