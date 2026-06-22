export type {
  CalmModeLevel,
  CalmModeSettings,
  InboxStressInput,
} from "@/lib/inbox-stress/types";

export { computeStressScore } from "@/lib/inbox-stress/detect";

export {
  updateCalmModeLevel,
  readCalmModeLevel,
  readCalmModeScore,
  readCalmModePersist,
  CALM_MODE_CHANGED_EVENT,
} from "@/lib/inbox-stress/calm-state";

export {
  getStressSessionSignals,
  recordStressSkip,
  recordStressQuickDone,
  recordStressDetailOpen,
  recordStressDetailLeave,
  recordOnboardingHesitation,
  STRESS_SESSION_CHANGED_EVENT,
} from "@/lib/inbox-stress/session-signals";

export {
  pickCalmHeadline,
  pickCalmReassurance,
  calmModeActiveCopy,
} from "@/lib/inbox-stress/copy";

export {
  filterCalmPriorityMessages,
  isCalmPriorityCategory,
  limitCalmSectionList,
} from "@/lib/inbox-stress/prioritize";

export { resolveCalmModeSettings } from "@/lib/inbox-stress/calm-settings";
