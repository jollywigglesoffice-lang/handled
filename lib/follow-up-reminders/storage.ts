import type { ConversationState, FollowUpReminderStatus } from "@/lib/follow-up/types";

export const FOLLOW_UP_REMINDERS_STORAGE_KEY = "handled_follow_up_reminders_v1";
export const SETUP_SQL = "supabase/sql/follow_up_reminders.sql";

export function isFollowUpRemindersTableMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("follow_up_reminders") &&
    (m.includes("does not exist") || m.includes("schema cache"))
  );
}

export function parseReminderStatus(raw: string | null | undefined): FollowUpReminderStatus {
  if (raw === "snoozed" || raw === "dismissed" || raw === "resolved") return raw;
  return "active";
}

export function parseConversationState(raw: string): ConversationState {
  const valid: ConversationState[] = [
    "awaiting_your_reply",
    "waiting_for_response",
    "follow_up_recommended",
    "pending_scheduling",
    "user_commitment_pending",
    "conversation_unresolved",
    "awaiting_approval",
    "pending_payment",
  ];
  return valid.includes(raw as ConversationState)
    ? (raw as ConversationState)
    : "conversation_unresolved";
}
