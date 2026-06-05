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
};

export type EmailCompletionMap = Record<string, EmailCompletionRecord>;

export type CompleteEmailInput = {
  emailId: string;
  actionId: CompletionActionId;
  actionLabel: string;
  sender: string;
  subject: string;
  snippet?: string;
  category: InboxAiCategory;
};
