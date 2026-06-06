import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Per-email completion record — Handled-only; separate from Gmail read state. */
export type EmailCompletionRecord = {
  emailId: string;
  actionId: CompletionActionId;
  /** Snapshot at completion time (survives action rename). */
  actionLabel: string;
  completedAt: number;
  sender: string;
  subject: string;
  snippet?: string;
  category: InboxAiCategory;
  senderDomain?: string;
  threadId?: string;
  /** Who the user is waiting on (waiting_on_someone). */
  waitingOn?: string;
  /** waiting → response_received while unresolved; cleared on resolve. */
  waitingStatus?: "waiting" | "response_received";
  /** Detected reply in the same thread. */
  waitingResponseEmailId?: string;
  waitingResponseDetectedAt?: number;
  waitingResponseSender?: string;
  waitingResponseSubject?: string;
  waitingResponseSnippet?: string;
  waitingResponseAt?: number;
  followUpAfterDays?: number;
  followUpAt?: number;
  /** Set when the user marks a waiting item resolved. */
  waitingResolvedAt?: number;
  /** Why the waiting item was closed. */
  waitingResolutionReason?: "received_response" | "no_longer_waiting";
  /** Updated when user taps "Still waiting". */
  stillWaitingAt?: number;
};

export type EmailCompletionMap = Record<string, EmailCompletionRecord>;

export type CompleteEmailExtras = {
  waitingOn?: string;
  followUpAfterDays?: number;
};

export type CompleteEmailInput = {
  emailId: string;
  actionId: CompletionActionId;
  actionLabel: string;
  sender: string;
  subject: string;
  snippet?: string;
  threadId?: string;
  category: InboxAiCategory;
} & CompleteEmailExtras;
