import {
  analyzeTimelineIntelligence,
  summarizeTimelineIntelligence,
} from "@/lib/timeline-intelligence/analyze";
import { groupMessagesByThread, toThreadSnapshot } from "@/lib/timeline-intelligence/thread-group";
import type {
  AnalyzeTimelineInput,
  TimelineIntelligenceSummary,
} from "@/lib/timeline-intelligence/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type MessageWithTimelineIntelligence<T> = T & {
  timelineIntelligence?: TimelineIntelligenceSummary;
};

export function enrichInboxWithTimelineIntelligence<
  T extends Pick<
    GmailInboxRow,
    "id" | "threadId" | "sender" | "subject" | "snippet" | "internalDateMs"
  > & { category?: InboxAiCategory },
>(rows: T[]): MessageWithTimelineIntelligence<T>[] {
  const threadGroups = groupMessagesByThread(rows);
  const allSnapshots = [...threadGroups.values()].flat();

  return rows.map((row) => {
    const snapshot = toThreadSnapshot(row);
    const threadMessages = threadGroups.get(row.threadId || row.id) ?? [snapshot];
    const analysis = analyzeTimelineIntelligence({
      row: snapshot,
      threadMessages,
    });
    const summary = summarizeTimelineIntelligence(analysis);
    if (!summary.active) return row;
    return { ...row, timelineIntelligence: summary };
  });
}

export function enrichMessageWithTimelineIntelligence<
  T extends Pick<
    GmailInboxRow,
    "id" | "threadId" | "sender" | "subject" | "snippet" | "internalDateMs"
  > & { category?: InboxAiCategory },
>(row: T, threadMessages?: AnalyzeTimelineInput["threadMessages"]): MessageWithTimelineIntelligence<T> {
  const snapshot = toThreadSnapshot(row);
  const analysis = analyzeTimelineIntelligence({
    row: snapshot,
    threadMessages,
  });
  const summary = summarizeTimelineIntelligence(analysis);
  if (!summary.active) return row;
  return { ...row, timelineIntelligence: summary };
}
