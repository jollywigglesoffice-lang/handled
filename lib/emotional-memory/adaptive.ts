import type { AdaptiveInboxSettings, EmotionalMemoryState } from "@/lib/emotional-memory/types";
import { deriveWorkStyleProfile } from "@/lib/emotional-memory/profile";

/** UI density and filtering knobs — informed by memory, never hard rules. */
export function resolveAdaptiveInboxSettings(
  state: EmotionalMemoryState,
): AdaptiveInboxSettings {
  const profile = deriveWorkStyleProfile(state);

  const focusPreviewCount =
    profile.densityPreference === "minimal"
      ? 2
      : profile.densityPreference === "detailed"
        ? 5
        : 3;

  return {
    focusPreviewCount,
    compactExplanations:
      profile.pace === "fast_responder" || profile.densityPreference === "minimal",
    aggressiveAutopilotFilter: profile.filteringStrength === "aggressive",
    compactOnboarding:
      profile.densityPreference === "minimal" &&
      (state.onboardingStyle === "fast" || profile.emotionalTone === "needs_space"),
    skipPersonalizeStep:
      profile.pace === "fast_responder" && profile.densityPreference === "minimal",
  };
}
