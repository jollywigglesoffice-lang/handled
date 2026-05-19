import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** High-level conversation status for timeline UI. */
export type ConversationStatus =
  | "open"
  | "waiting"
  | "escalating"
  | "resolved"
  | "stalled"
  | "needs_follow_up";

export type EmotionalTrajectory =
  | "calm"
  | "urgent"
  | "frustrated"
  | "actionable"
  | "informational"
  | "escalating";

export type ThreadMemory = {
  requestedActions: string[];
  mentionedDeadlines: string[];
  mentionedAttachments: boolean;
  unresolvedCommitments: string[];
  /** Inferred from subject + thread siblings in batch */
  followUpCount: number;
  userRepliedHeuristic: boolean;
  otherRepliedHeuristic: boolean;
};

export type ConversationProgression = {
  repeatedFollowUps: boolean;
  escalatingUrgency: boolean;
  unresolvedThread: boolean;
  pendingRequest: boolean;
  longRunning: boolean;
  threadSpanDays: number;
};

export type ThreadMessageSnapshot = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  internalDateMs: number;
  category?: InboxAiCategory;
};

export type TimelineIntelligenceResult = {
  active: boolean;
  conversationStatus: ConversationStatus;
  trajectory: EmotionalTrajectory;
  escalationScore: number;
  timelineSummary: string;
  calmDetail?: string;
  threadMemory: ThreadMemory;
  progression: ConversationProgression;
  /** Added to follow-up / triage urgency (0–25) */
  visibilityBoost: number;
};

export type TimelineIntelligenceSummary = {
  active: boolean;
  conversationStatus: ConversationStatus;
  timelineSummary: string;
  escalationScore: number;
};

export type AnalyzeTimelineInput = {
  row: ThreadMessageSnapshot;
  extraBody?: string;
  threadMessages?: ThreadMessageSnapshot[];
  locale?: "en" | "it";
};

export type TimelineIntegrationId =
  | "crm_memory"
  | "relationship_history"
  | "recurring_patterns"
  | "client_history";

export type TimelineIntegrationDescriptor = {
  id: TimelineIntegrationId;
  status: "available" | "planned" | "connected";
  description: string;
};
