export type {
  FollowUpDisplayState,
  FollowUpTimingSuggestion,
  FollowUpTimingTone,
  SmartFollowUpDraftTone,
  SmartFollowUpEnrichment,
  StalledConversationSignals,
} from "@/lib/follow-up/smart-engine/types";

export {
  detectStalledSignals,
  isLikelyClosedConversation,
} from "@/lib/follow-up/smart-engine/detect-stalled";

export { suggestFollowUpTiming } from "@/lib/follow-up/smart-engine/timing";

export { followUpDraftTone } from "@/lib/follow-up/smart-engine/relationship-tone";

export {
  enrichWithSmartFollowUp,
  resolveStateWithSmartSignals,
  shouldSurfaceInFollowUpSection,
} from "@/lib/follow-up/smart-engine/enrich";

