export type GuidedOnboardingStep =
  | "connect"
  | "intro"
  | "train_worth_your_attention"
  | "train_good_to_know"
  | "train_promotions"
  | "train_newsletters"
  | "release";

export const GUIDED_ONBOARDING_STEPS: GuidedOnboardingStep[] = [
  "connect",
  "intro",
  "train_worth_your_attention",
  "train_good_to_know",
  "train_promotions",
  "train_newsletters",
  "release",
];

export const TRAINING_ONBOARDING_STEPS = [
  "train_worth_your_attention",
  "train_good_to_know",
  "train_promotions",
  "train_newsletters",
] as const satisfies readonly GuidedOnboardingStep[];

export type TrainingOnboardingStep = (typeof TRAINING_ONBOARDING_STEPS)[number];

export function stepIndex(step: GuidedOnboardingStep): number {
  return GUIDED_ONBOARDING_STEPS.indexOf(step);
}

export function stepNumber(step: GuidedOnboardingStep): number {
  return stepIndex(step) + 1;
}

export function nextGuidedStep(step: GuidedOnboardingStep): GuidedOnboardingStep | null {
  const idx = stepIndex(step);
  if (idx < 0 || idx >= GUIDED_ONBOARDING_STEPS.length - 1) return null;
  return GUIDED_ONBOARDING_STEPS[idx + 1] ?? null;
}

export function trainingStepCategory(
  step: TrainingOnboardingStep,
): "worth_your_attention" | "good_to_know" | "promotions" | "newsletters" {
  return step.replace("train_", "") as
    | "worth_your_attention"
    | "good_to_know"
    | "promotions"
    | "newsletters";
}
