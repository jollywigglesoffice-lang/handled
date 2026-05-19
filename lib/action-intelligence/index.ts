export type {
  ActionIntegrationDescriptor,
  ActionIntegrationId,
  ActionIntegrationStatus,
  ActionIntelligenceResult,
  ActionIntelligenceSummary,
  ActionLabelId,
  AnalyzeActionIntelligenceInput,
  ImpliedActionKind,
  SafeReminderSuggestion,
  TaskAwarenessItem,
} from "@/lib/action-intelligence/types";

export {
  analyzeActionIntelligence,
  formatActionIntelligenceForPrompt,
  summarizeActionIntelligence,
} from "@/lib/action-intelligence/analyze";

export {
  detectImpliedActions,
  isActionableEmail,
} from "@/lib/action-intelligence/detect-implied-actions";

export { extractTaskAwareness } from "@/lib/action-intelligence/task-awareness";

export {
  actionLabelTitle,
  actionLabelTone,
  impliedActionsToLabels,
  pickPrimaryLabel,
} from "@/lib/action-intelligence/labels";

export { suggestNextAction } from "@/lib/action-intelligence/suggest-next-action";

export {
  buildSafeReminders,
  REMINDER_SAFETY_NOTE_EN,
  REMINDER_SAFETY_NOTE_IT,
} from "@/lib/action-intelligence/safe-reminders";

export { listActionIntegrations } from "@/lib/action-intelligence/integrations";

export {
  analyzeRowActions,
  enrichMessageWithActionIntelligence,
  type MessageWithActionIntelligence,
} from "@/lib/action-intelligence/enrich";
