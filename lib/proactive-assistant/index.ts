export type {
  AnalyzeProactiveInput,
  IncompleteAction,
  ProactiveAssistantResult,
  ProactiveAssistantSummary,
  ProactiveIntegrationDescriptor,
  ProactiveIntegrationId,
  ProactiveSuggestion,
  ProactiveSuggestionKind,
  UpcomingCommitment,
  UpcomingCommitmentKind,
} from "@/lib/proactive-assistant/types";

export {
  analyzeProactiveAssistant,
  analyzeProactiveAssistantInbox,
  formatProactiveForPrompt,
  summarizeProactiveAssistant,
} from "@/lib/proactive-assistant/analyze";

export { detectUpcomingCommitments } from "@/lib/proactive-assistant/detect-commitments";
export { detectIncompleteActions } from "@/lib/proactive-assistant/detect-incomplete";
export { scoreProactiveUrgency, sortSuggestions } from "@/lib/proactive-assistant/urgency";
export { buildProactiveSuggestions } from "@/lib/proactive-assistant/suggestions";
export { listProactiveIntegrations } from "@/lib/proactive-assistant/integrations";

export {
  dismissProactiveSuggestion,
  filterDismissedSuggestions,
  loadDismissedProactiveIds,
} from "@/lib/proactive-assistant/client-storage";

export {
  enrichInboxProactiveSummaries,
  enrichMessageWithProactiveAssistant,
  type MessageWithProactiveAssistant,
} from "@/lib/proactive-assistant/enrich";
