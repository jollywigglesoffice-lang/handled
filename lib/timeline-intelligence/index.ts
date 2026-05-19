export type {
  AnalyzeTimelineInput,
  ConversationProgression,
  ConversationStatus,
  EmotionalTrajectory,
  ThreadMemory,
  ThreadMessageSnapshot,
  TimelineIntegrationDescriptor,
  TimelineIntegrationId,
  TimelineIntelligenceResult,
  TimelineIntelligenceSummary,
} from "@/lib/timeline-intelligence/types";

export {
  analyzeTimelineIntelligence,
  formatTimelineForPrompt,
  summarizeTimelineIntelligence,
} from "@/lib/timeline-intelligence/analyze";

export { detectEscalation } from "@/lib/timeline-intelligence/detect-escalation";
export { detectEmotionalTrajectory, trajectoryAdaptationHint } from "@/lib/timeline-intelligence/detect-emotional-trajectory";
export { analyzeConversationProgression } from "@/lib/timeline-intelligence/detect-progression";
export { resolveConversationStatus } from "@/lib/timeline-intelligence/conversation-status";
export { buildTimelineSummary } from "@/lib/timeline-intelligence/timeline-summary";
export {
  extractThreadMemory,
  countFollowUpsInHay,
} from "@/lib/timeline-intelligence/thread-memory";
export {
  groupMessagesByThread,
  siblingsInThread,
  toThreadSnapshot,
} from "@/lib/timeline-intelligence/thread-group";
export { listTimelineIntegrations } from "@/lib/timeline-intelligence/integrations";

export {
  conversationStatusLabel,
  conversationStatusTone,
  trajectoryLabel,
} from "@/lib/timeline-intelligence/labels";

export {
  enrichInboxWithTimelineIntelligence,
  enrichMessageWithTimelineIntelligence,
  type MessageWithTimelineIntelligence,
} from "@/lib/timeline-intelligence/enrich";
