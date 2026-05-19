import type { ThreadMessageSnapshot } from "@/lib/timeline-intelligence/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export function toThreadSnapshot(
  row: Pick<
    GmailInboxRow,
    "id" | "threadId" | "sender" | "subject" | "snippet" | "internalDateMs"
  > & { category?: InboxAiCategory },
): ThreadMessageSnapshot {
  return {
    id: row.id,
    threadId: row.threadId,
    sender: row.sender,
    subject: row.subject,
    snippet: row.snippet,
    internalDateMs: row.internalDateMs,
    category: row.category,
  };
}

/** Group inbox rows by Gmail threadId for batch timeline analysis. */
export function groupMessagesByThread(
  rows: Array<
    Pick<
      GmailInboxRow,
      "id" | "threadId" | "sender" | "subject" | "snippet" | "internalDateMs"
    > & { category?: InboxAiCategory }
  >,
): Map<string, ThreadMessageSnapshot[]> {
  const map = new Map<string, ThreadMessageSnapshot[]>();
  for (const row of rows) {
    const key = row.threadId || row.id;
    const list = map.get(key) ?? [];
    list.push(toThreadSnapshot(row));
    map.set(key, list);
  }
  return map;
}

export function siblingsInThread(
  row: ThreadMessageSnapshot,
  all: ThreadMessageSnapshot[],
): ThreadMessageSnapshot[] {
  return all.filter((m) => m.threadId === row.threadId);
}
