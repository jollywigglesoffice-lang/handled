import type { CategoryApplyScope } from "@/lib/category-correction";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type InboxCategoryChangeOptions = {
  scope?: CategoryApplyScope;
  sender?: string;
  guessedCategory?: InboxAiCategory;
};
