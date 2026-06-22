export type {
  AdaptiveInboxSettings,
  DensityPreference,
  EmotionalActionKind,
  EmotionalMemoryState,
  EmotionalTone,
  FilteringStrength,
  OnboardingStyle,
  WorkPace,
  WorkStyleProfile,
} from "@/lib/emotional-memory/types";

export {
  defaultEmotionalMemoryState,
  readEmotionalMemory,
  writeEmotionalMemory,
  EMOTIONAL_MEMORY_CHANGED_EVENT,
} from "@/lib/emotional-memory/store";

export { deriveWorkStyleProfile, isReturningUser } from "@/lib/emotional-memory/profile";

export { resolveAdaptiveInboxSettings } from "@/lib/emotional-memory/adaptive";

export {
  pickReturningSubline,
  pickReturningWelcome,
} from "@/lib/emotional-memory/returning-copy";

export {
  getSavedInboxMode,
  mapCompletionToEmotionalAction,
  recordEmotionalAction,
  recordEmotionalSessionStart,
  recordOnboardingComplete,
  savePreferredInboxMode,
} from "@/lib/emotional-memory/record";

export { isEmotionalInboxVisible } from "@/lib/emotional-memory/inbox-filter";
