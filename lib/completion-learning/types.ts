import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type CompletionPatternScope =
  | "global"
  | "category"
  | "sender"
  | "sender_domain"
  | "category_domain"
  | "subject_keyword"
  | "category_keyword";

/** Snapshot used later for suggestion examples — not shown in UI yet. */
export type CompletionLearningExample = {
  emailId: string;
  sender: string;
  subject: string;
  completedAt: number;
};

/**
 * Aggregated learning signal for future suggested completion actions.
 * No automation — confidence + sampleCount only.
 */
export type CompletionLearningPattern = {
  completionPattern: string;
  scope: CompletionPatternScope;
  actionId: CompletionActionId;
  category?: InboxAiCategory;
  senderDomain?: string;
  senderRuleKey?: string;
  subjectKeyword?: string;
  sampleCount: number;
  confidence: number;
  examples: CompletionLearningExample[];
  lastUsedAt: number;
};

/** Raw per-completion event — full audit trail for learning. */
export type CompletionLearningEvent = {
  emailId: string;
  sender: string;
  senderDomain?: string;
  senderRuleKey: string;
  category: InboxAiCategory;
  actionId: CompletionActionId;
  actionLabel: string;
  completedAt: number;
};

export type CompletionLearningStats = {
  version: 2;
  patterns: CompletionLearningPattern[];
  events: CompletionLearningEvent[];
};

export const EMPTY_COMPLETION_LEARNING: CompletionLearningStats = {
  version: 2,
  patterns: [],
  events: [],
};
