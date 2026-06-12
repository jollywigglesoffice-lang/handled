import type { CategoryApplyScope } from "@/lib/category-correction";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { SenderPreference } from "@/lib/inbox-sender-preferences";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type CategoryUndoMessageState = {
  id: string;
  /** Owning connected account — needed for account-scoped override keys. */
  accountId?: string;
  category: InboxAiCategory;
  categorySource?: string;
};

export type CategoryUndoSnapshot = {
  scope: CategoryApplyScope;
  triggerEmailId: string;
  senderLine?: string;
  newCategory: InboxAiCategory;
  affectedIds: string[];
  previousMessages: CategoryUndoMessageState[];
  previousOverrides: Record<string, InboxAiCategory>;
  previousEmailOverrides: EmailCategoryOverride[];
  previousSenderPrefs: SenderPreference[];
  previousInboxRules: InboxUserRule[];
};
