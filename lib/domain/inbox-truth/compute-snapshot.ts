import { completedHistoryRecords } from "@/lib/completion-stats";
import type { EmailCompletionMap } from "@/lib/email-completions/types";
import { waitingOpenRecords } from "@/lib/waiting-on/helpers";
import type { GmailTruthStats, InboxTruthSnapshot } from "@/lib/inbox-truth/types";

export function buildInboxTruthSnapshot(input: {
  gmailTruth: GmailTruthStats | null;
  loadedCount: number;
  visibleCount: number;
  completions: EmailCompletionMap;
}): InboxTruthSnapshot {
  return {
    gmailInboxTotal: input.gmailTruth?.inboxTotal ?? null,
    gmailUnreadTotal: input.gmailTruth?.unreadTotal ?? null,
    loadedCount: input.loadedCount,
    visibleCount: input.visibleCount,
    completedCount: completedHistoryRecords(input.completions).length,
    waitingOnCount: waitingOpenRecords(input.completions).length,
  };
}
