import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Aggregated learning signal — used later for suggested completions (not yet surfaced in UI). */
export type CompletionLearningPattern = {
  actionId: CompletionActionId;
  category?: InboxAiCategory;
  senderDomain?: string;
  subjectKeyword?: string;
  count: number;
  lastUsedAt: number;
};

export type CompletionLearningStats = {
  version: 1;
  patterns: CompletionLearningPattern[];
};

export const EMPTY_COMPLETION_LEARNING: CompletionLearningStats = {
  version: 1,
  patterns: [],
};
