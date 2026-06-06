export type {
  AnalyzeDailyBriefingInput,
  BriefingScheduleDescriptor,
  BriefingScheduleKind,
  DailyBriefingGroup,
  DailyBriefingGroupId,
  DailyBriefingHighlight,
  DailyBriefingInsight,
  DailyBriefingInsightTone,
  DailyBriefingIntegrationDescriptor,
  DailyBriefingIntegrationId,
  DailyBriefingMessage,
  DailyBriefingResult,
  DailyBriefingStats,
} from "@/lib/daily-briefing/types";

export {
  analyzeDailyBriefing,
  formatDailyBriefingForPrompt,
} from "@/lib/daily-briefing/analyze";

export { buildBriefingGroups, assignPrimaryBriefingGroup } from "@/lib/daily-briefing/group";
export { buildBriefingHighlights } from "@/lib/daily-briefing/highlights";
export { buildBriefingInsights } from "@/lib/daily-briefing/insights";
export { detectMessageBriefingSignals } from "@/lib/daily-briefing/detect-signals";
export { listDailyBriefingIntegrations, listBriefingSchedules } from "@/lib/daily-briefing/integrations";
export {
  buildInboxBriefingCard,
  type InboxBriefingCardModel,
  type InboxBriefingLine,
} from "@/lib/daily-briefing/inbox-briefing";
export { detectImportantChanges, type ImportantChange } from "@/lib/daily-briefing/important-changes";
export {
  buildVisitSnapshot,
  isEmailNewSinceVisit,
  loadVisitSnapshot,
  saveVisitSnapshot,
  type InboxVisitSnapshot,
} from "@/lib/daily-briefing/visit-snapshot";
