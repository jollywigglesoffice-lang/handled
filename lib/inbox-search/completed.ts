import { matchesInboxSearchFilters } from "@/lib/inbox-search/query";
import type { InboxSearchFilters } from "@/lib/inbox-search/types";
import type { EmailCompletionMap, EmailCompletionRecord } from "@/lib/email-completions/types";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import { completedHistoryRecords } from "@/lib/completion-stats";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export function searchCompletionRecords(
  completions: EmailCompletionMap,
  filters: InboxSearchFilters,
  readMap: ReadStateMap,
): EmailCompletionRecord[] {
  const q = filters.query.trim();
  if (q.length < 2) return [];

  return completedHistoryRecords(completions).filter((record) =>
    matchesInboxSearchFilters(
      {
        id: record.emailId,
        sender: record.sender,
        subject: record.subject,
        snippet: record.snippet ?? "",
        category: record.category,
        accountId: record.accountId,
      },
      filters,
      readMap,
    ),
  );
}

export function completionRecordToSearchMessage(
  record: EmailCompletionRecord,
): import("@/lib/inbox-search/types").InboxSearchMessage {
  return {
    id: record.emailId,
    threadId: record.threadId ?? record.emailId,
    sender: record.sender,
    subject: record.subject,
    snippet: record.snippet ?? "",
    date: new Date(record.completedAt).toISOString(),
    internalDateMs: record.completedAt,
    category: record.category as InboxAiCategory,
    accountId: record.accountId,
    accountEmail: record.accountEmail,
    accountLabel: record.accountLabel,
    searchCompleted: true,
    completionActionLabel: record.actionLabel,
  };
}
