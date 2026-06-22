import type { OnboardingPreferencesMemory } from "@/lib/onboarding/conversation-copy";
import type { InboxInteractionMode } from "@/lib/inbox-interaction-mode";

export type EmotionalActionKind = "reply" | "done" | "skip" | "open";

export type OnboardingStyle = "fast" | "exploratory" | null;

export type DensityPreference = "minimal" | "balanced" | "detailed";
export type FilteringStrength = "light" | "normal" | "aggressive";
export type WorkPace = "fast_responder" | "steady" | "exploratory";
export type EmotionalTone = "calm" | "confident" | "needs_space" | "balanced";

/** Derived work-style profile — soft signals only, never strict rules. */
export type WorkStyleProfile = {
  densityPreference: DensityPreference;
  filteringStrength: FilteringStrength;
  pace: WorkPace;
  emotionalTone: EmotionalTone;
};

export type EmotionalMemoryState = {
  version: 1;
  totalSessions: number;
  lastVisitAt: number | null;
  actions: {
    reply: number;
    done: number;
    skip: number;
    open: number;
  };
  /** Rolling window for recent session behavior (last 5 sessions). */
  recentSessions: Array<{
    at: number;
    reply: number;
    done: number;
    skip: number;
    volumeAtStart: number;
  }>;
  onboardingStyle: OnboardingStyle;
  preferencesMemory: OnboardingPreferencesMemory | null;
  savedInboxMode: InboxInteractionMode | null;
  /** Ms from onboarding start to completion — fast if under threshold. */
  lastOnboardingDurationMs: number | null;
};

export type AdaptiveInboxSettings = {
  focusPreviewCount: number;
  compactExplanations: boolean;
  aggressiveAutopilotFilter: boolean;
  compactOnboarding: boolean;
  skipPersonalizeStep: boolean;
};

export const EMOTIONAL_MEMORY_STORAGE_KEY = "handled_emotional_memory_v1";
export const EMOTIONAL_WELCOME_SESSION_KEY = "handled:emotional-welcome-shown";
export const FAST_ONBOARDING_MS = 90_000;
