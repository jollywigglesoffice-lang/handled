import { scopedEmailKey } from "@/lib/gmail/account-types";
import {
  completionRecordToSearchMessage,
  searchCompletionRecords,
} from "@/lib/inbox-search/completed";
import { matchesInboxSearchFilters } from "@/lib/inbox-search/query";
import type {
  InboxSearchFilters,
  InboxSearchMessage,
  InboxSearchResultSet,
} from "@/lib/inbox-search/types";
import type { EmailCompletionMap } from "@/lib/email-completions/types";
import type { ReadStateMap } from "@/lib/read-state/client-storage";

export function filterMessagesForInboxSearch<T extends InboxSearchMessage>(
  messages: T[],
  filters: InboxSearchFilters,
  readMap: ReadStateMap,
): T[] {
  const q = filters.query.trim();
  if (q.length < 2) return [];
  return messages.filter((m) => matchesInboxSearchFilters(m, filters, readMap));
}

export function mergeInboxSearchResults(input: {
  gmailResults: InboxSearchMessage[];
  loadedMessages: InboxSearchMessage[];
  completions: EmailCompletionMap;
  filters: InboxSearchFilters;
  readMap: ReadStateMap;
}): InboxSearchResultSet {
  const seen = new Set<string>();
  const inbox: InboxSearchMessage[] = [];

  const add = (m: InboxSearchMessage) => {
    const key = scopedEmailKey(m.id, m.accountId);
    if (seen.has(key)) return;
    seen.add(key);
    inbox.push(m);
  };

  for (const m of input.gmailResults) {
    if (matchesInboxSearchFilters(m, input.filters, input.readMap)) add(m);
  }

  for (const m of filterMessagesForInboxSearch(input.loadedMessages, input.filters, input.readMap)) {
    add(m);
  }

  const completedRecords = searchCompletionRecords(
    input.completions,
    input.filters,
    input.readMap,
  );

  for (const record of completedRecords) {
    const key = scopedEmailKey(record.emailId, record.accountId);
    if (seen.has(key)) {
      const existing = inbox.find(
        (m) => scopedEmailKey(m.id, m.accountId) === key,
      );
      if (existing) {
        existing.searchCompleted = true;
        existing.completionActionLabel = record.actionLabel;
      }
      continue;
    }
    seen.add(key);
    add(completionRecordToSearchMessage(record));
  }

  inbox.sort((a, b) => (b.internalDateMs ?? 0) - (a.internalDateMs ?? 0));

  const completedOnly = completedRecords.filter(
    (r) => !inbox.some((m) => scopedEmailKey(m.id, m.accountId) === scopedEmailKey(r.emailId, r.accountId)),
  );

  return { inbox, completedOnly };
}
