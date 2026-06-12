import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type EmailCategoryOverride = {
  /**
   * Storage key for the override. For multi-account safety this is the
   * account-scoped composite `accountId:gmailMessageId` when the account is
   * known; legacy records hold the raw Gmail message id (only unique within
   * one mailbox). Lookups must try the scoped key first, then the raw id.
   */
  emailId: string;
  originalCategory: InboxAiCategory | null;
  overriddenCategory: InboxAiCategory;
  createdAt: string;
  updatedAt: string;
};
