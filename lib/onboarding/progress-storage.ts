import type { GuidedOnboardingStep } from "@/lib/onboarding/guided-steps";
import type { TrainingClassifications } from "@/lib/onboarding/category-training";

export const ONBOARDING_PROGRESS_KEY = "handled_onboarding_progress_v1";
export const ONBOARDING_TRAINING_STATE_KEY = "handled_onboarding_training_state_v1";

export type OnboardingProgress = {
  step: GuidedOnboardingStep;
  updatedAt: string;
};

export type OnboardingTrainingState = {
  classifications: TrainingClassifications;
  refreshIndexByStep: Record<string, number>;
  updatedAt: string;
};

export function readOnboardingProgress(): OnboardingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    if (!parsed.step || typeof parsed.step !== "string") return null;
    return {
      step: parsed.step as GuidedOnboardingStep,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(progress: OnboardingProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* private mode / quota */
  }
}

export function readOnboardingTrainingState(): OnboardingTrainingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_TRAINING_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingTrainingState>;
    if (!parsed.classifications || typeof parsed.classifications !== "object") return null;
    return {
      classifications: {
        emails:
          parsed.classifications.emails && typeof parsed.classifications.emails === "object"
            ? parsed.classifications.emails
            : {},
        senders:
          parsed.classifications.senders && typeof parsed.classifications.senders === "object"
            ? parsed.classifications.senders
            : {},
      },
      refreshIndexByStep:
        parsed.refreshIndexByStep && typeof parsed.refreshIndexByStep === "object"
          ? parsed.refreshIndexByStep
          : {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveOnboardingTrainingState(state: OnboardingTrainingState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDING_TRAINING_STATE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

export function clearOnboardingProgressStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
    localStorage.removeItem(ONBOARDING_TRAINING_STATE_KEY);
  } catch {
    /* ignore */
  }
}
