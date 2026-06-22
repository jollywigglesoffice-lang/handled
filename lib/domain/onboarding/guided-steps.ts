export type GuidedOnboardingStep =
  | "connect"
  | "preferences"
  | "first_action"
  | "personalize"
  | "release";

export const GUIDED_ONBOARDING_STEPS: GuidedOnboardingStep[] = [
  "connect",
  "preferences",
  "first_action",
  "personalize",
  "release",
];

export function stepIndex(step: GuidedOnboardingStep): number {
  return GUIDED_ONBOARDING_STEPS.indexOf(step);
}

export function stepNumber(step: GuidedOnboardingStep): number {
  return stepIndex(step) + 1;
}
