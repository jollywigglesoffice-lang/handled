import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { EmailIntentKind } from "@/lib/email-intent";

/** Conversation state for follow-up intelligence. */
export type ConversationState =
  | "awaiting_your_reply"
  | "waiting_for_response"
  | "follow_up_recommended"
  | "pending_scheduling"
  | "user_commitment_pending"
  | "conversation_unresolved";

export type FollowUpReminderStatus = "active" | "snoozed" | "dismissed" | "resolved";

/** Heuristic analysis for a single message (no persistence). */
export type FollowUpAnalysis = {
  emailId: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  category: InboxAiCategory;
  state: ConversationState;
  urgencyScore: number;
  /** Calm one-line for UI */
  headline: string;
  /** Supportive secondary line */
  calmPrompt: string;
  intentKinds: EmailIntentKind[];
  reasons: string[];
  daysSinceMessage: number;
  suggestedFollowUpDays?: number;
  detectedCommitment?: string;
};

/** Persisted reminder row (DB + client). */
export type FollowUpReminderRecord = {
  id: string;
  emailId: string;
  threadId?: string;
  conversationState: ConversationState;
  urgencyScore: number;
  reminderTitle: string;
  reminderBody: string;
  status: FollowUpReminderStatus;
  snoozedUntil: string | null;
  analysis?: FollowUpAnalysis;
  createdAt: string;
  updatedAt: string;
};

/** Merged view for inbox UI. */
export type FollowUpInboxItem = FollowUpAnalysis & {
  reminderId?: string;
  status: FollowUpReminderStatus;
  snoozedUntil: string | null;
};

export type FollowUpSectionKey =
  | "follow_ups"
  | "waiting_on"
  | "unresolved"
  | "pending";

export function sectionKeyForState(state: ConversationState): FollowUpSectionKey {
  switch (state) {
    case "awaiting_your_reply":
    case "user_commitment_pending":
      return "pending";
    case "waiting_for_response":
      return "waiting_on";
    case "follow_up_recommended":
      return "follow_ups";
    case "pending_scheduling":
      return "pending";
    default:
      return "unresolved";
  }
}
