import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type EmailCategoryOverride = {
  emailId: string;
  originalCategory: InboxAiCategory | null;
  overriddenCategory: InboxAiCategory;
  createdAt: string;
  updatedAt: string;
};
