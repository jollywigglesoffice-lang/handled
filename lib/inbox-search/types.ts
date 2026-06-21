import type { CategoryTab } from "@/app/emails/category-tabs";
import type { AccountFilterValue } from "@/app/emails/inbox-source-switcher";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";

export type InboxSearchReadFilter = "all" | "read" | "unread";

export type InboxSearchFilters = {
  query: string;
  category: CategoryTab;
  accountId: AccountFilterValue;
  read: InboxSearchReadFilter;
};

export const INBOX_SEARCH_MIN_QUERY_LEN = 2;

export type InboxSearchMessage = GmailInboxRow & {
  category: InboxAiCategory;
  categoryConfidence?: number;
  categorySource?: string;
  relationship?: import("@/lib/relationship-intelligence/types").SenderRelationshipProfile;
  /** Present when matched from local completion history (not in current inbox load). */
  searchCompleted?: boolean;
  completionActionLabel?: string;
};

export type InboxSearchResultSet = {
  inbox: InboxSearchMessage[];
  completedOnly: EmailCompletionRecord[];
};
