import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Minimum trust before sender memory auto-applies over AI. */
export const MEMORY_AUTO_APPLY_THRESHOLD = 0.55;

/** Minimum repeated corrections before correction-history rule applies. */
export const MEMORY_CORRECTION_HISTORY_THRESHOLD = 2;

export type BehaviorContext = "inbox" | "inbox_zero" | "detail" | "feedback";

export type SenderMemoryRecord = {
  id?: string;
  senderEmail: string | null;
  senderDomain: string | null;
  /** @deprecated use preferredCategory */
  category: InboxAiCategory;
  preferredCategory: InboxAiCategory;
  correctionCount: number;
  trustScore: number;
  replyLikelihood: number;
  confidence: number;
  source: string;
  lastEmailId?: string | null;
  accountId?: string | null;
};

export type CategoryCorrectionRecord = {
  sender: string | null;
  senderEmail: string | null;
  senderDomain: string | null;
  aiCategory: InboxAiCategory;
  userCategory: InboxAiCategory;
  correctionReason: string | null;
  correctionCount: number;
};

export type CategoryPatternMemory = {
  senderDomain: string;
  subjectKeyword: string;
  category: InboxAiCategory;
  correctionCount: number;
  confidence: number;
};

export type ActionMemoryRecord = {
  senderEmail: string | null;
  senderDomain: string | null;
  actionId: CompletionActionId;
  category: InboxAiCategory | null;
  sampleCount: number;
};

export type MemoryEngineSnapshot = {
  senderMemory: SenderMemoryRecord[];
  categoryCorrections: CategoryCorrectionRecord[];
  categoryPatterns: CategoryPatternMemory[];
  actionMemory: ActionMemoryRecord[];
};

export type MemoryCollectAction =
  | "category_correction"
  | "user_override"
  | "completion_action"
  | "email_opened"
  | "email_viewed_no_action"
  | "feedback";

export type MemoryCollectPayload = {
  action: MemoryCollectAction;
  emailId: string;
  accountId?: string;
  sender: string;
  subject?: string;
  guessedCategory?: InboxAiCategory;
  chosenCategory?: InboxAiCategory;
  category?: InboxAiCategory;
  previousCategory?: InboxAiCategory | null;
  scope?: string;
  correctionReason?: string;
  actionId?: CompletionActionId;
  actionLabel?: string;
  context?: BehaviorContext;
  feedbackCategory?: string;
  feedbackMessage?: string;
};
