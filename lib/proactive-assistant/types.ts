import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type ProactiveSuggestionKind =
  | "follow_up_today"
  | "deadline_approaching"
  | "meeting_unconfirmed"
  | "commitment_due"
  | "vip_unanswered"
  | "missing_attachment"
  | "pending_approval"
  | "scheduling_open"
  | "travel_context"
  | "incomplete_action"
  | "payment_pending";

export type UpcomingCommitmentKind =
  | "promised_follow_up"
  | "deadline"
  | "meeting"
  | "approval"
  | "payment"
  | "attachment";

export type UpcomingCommitment = {
  kind: UpcomingCommitmentKind;
  description: string;
  whenHint?: string;
};

export type IncompleteAction = {
  kind: "attachment" | "invoice" | "scheduling" | "reply" | "approval";
  description: string;
};

/** Calm proactive hint — never auto-executed. */
export type ProactiveSuggestion = {
  id: string;
  emailId: string;
  threadId?: string;
  sender: string;
  subject: string;
  kind: ProactiveSuggestionKind;
  message: string;
  calmDetail?: string;
  urgencyScore: number;
  requiresUserApproval: true;
  dismissible: true;
};

export type ProactiveAssistantResult = {
  active: boolean;
  suggestions: ProactiveSuggestion[];
  urgencyScore: number;
  upcomingCommitments: UpcomingCommitment[];
  incompleteActions: IncompleteAction[];
};

export type ProactiveAssistantSummary = {
  active: boolean;
  topSuggestion: ProactiveSuggestion | null;
  suggestionCount: number;
  urgencyScore: number;
};

export type AnalyzeProactiveInput = {
  row: {
    id: string;
    threadId?: string;
    sender: string;
    subject: string;
    snippet: string;
    internalDateMs: number;
    category?: InboxAiCategory;
  };
  extraBody?: string;
  locale?: "en" | "it";
};

export type ProactiveIntegrationId =
  | "smart_reminders"
  | "predictive_assistance"
  | "daily_briefing"
  | "morning_digest"
  | "operational_summary";

export type ProactiveIntegrationDescriptor = {
  id: ProactiveIntegrationId;
  status: "available" | "planned" | "connected";
  description: string;
};
