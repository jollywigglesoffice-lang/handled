import { readEmotionalMemory, writeEmotionalMemory } from "@/lib/emotional-memory/store";
import { clearFirstOnboardingComplete } from "@/lib/onboarding/first-time";
import { clearOnboardingProgressStorage } from "@/lib/onboarding/progress-storage";

/** Set to "true" in localStorage to reset onboarding on next inbox load. */
export const ONBOARDING_RESET_FLAG_KEY = "handled_reset_onboarding";

export const ONBOARDING_RESET_QUERY_PARAM = "resetOnboarding";

export const ONBOARDING_RESET_EVENT = "handled-onboarding-reset";

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

function hasQueryResetParam(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(ONBOARDING_RESET_QUERY_PARAM) === "true";
}

function hasStorageResetFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_RESET_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}

function consumeQueryResetParam(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get(ONBOARDING_RESET_QUERY_PARAM) !== "true") return;
  params.delete(ONBOARDING_RESET_QUERY_PARAM);
  const qs = params.toString();
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, "", next);
}

function consumeStorageResetFlag(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ONBOARDING_RESET_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

/** Clears onboarding-only emotional memory fields (not inbox behavior or category learning). */
function clearOnboardingEmotionalMemoryFields(): void {
  const state = readEmotionalMemory();
  state.preferencesMemory = null;
  state.lastOnboardingDurationMs = null;
  state.onboardingStyle = null;
  writeEmotionalMemory(state);
}

/**
 * Clears onboarding flow state only.
 * Does NOT touch email data, sender rules, email overrides, or inbox cache.
 */
export function resetOnboardingState(): void {
  if (typeof window === "undefined") return;
  clearFirstOnboardingComplete();
  clearOnboardingProgressStorage();
  clearOnboardingEmotionalMemoryFields();
}

function isExplicitResetRequested(): boolean {
  return hasQueryResetParam() || hasStorageResetFlag();
}

/** Reset is allowed in development or when an explicit trigger is present. */
export function isOnboardingResetAllowed(): boolean {
  return isDevelopment() || isExplicitResetRequested();
}

/**
 * Apply onboarding reset when explicitly triggered via query param or localStorage flag.
 * Returns true when reset ran.
 */
export function tryApplyOnboardingReset(): boolean {
  if (typeof window === "undefined") return false;
  if (!isOnboardingResetAllowed()) return false;
  if (!isExplicitResetRequested()) return false;

  const fromQuery = hasQueryResetParam();
  const fromStorage = hasStorageResetFlag();

  resetOnboardingState();

  if (fromQuery) consumeQueryResetParam();
  if (fromStorage) consumeStorageResetFlag();

  window.dispatchEvent(new Event(ONBOARDING_RESET_EVENT));
  return true;
}

/** Dev-only console helper: `window.handledResetOnboarding()` */
export function registerOnboardingResetDevHelper(): void {
  if (!isDevelopment() || typeof window === "undefined") return;
  const globalWindow = window as Window & { handledResetOnboarding?: () => boolean };
  if (globalWindow.handledResetOnboarding) return;
  globalWindow.handledResetOnboarding = () => {
    resetOnboardingState();
    window.dispatchEvent(new Event(ONBOARDING_RESET_EVENT));
    return true;
  };
}
