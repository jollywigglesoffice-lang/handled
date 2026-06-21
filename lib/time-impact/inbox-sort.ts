import type { InboxBuckets, InboxBucketMessage } from "@/lib/inbox-buckets";
import { classifyTimeImpact } from "@/lib/time-impact/classify";
import type { TimeImpactResult } from "@/lib/time-impact/types";
import { resolveInboxEmotionalState } from "@/lib/inbox-emotional-state";
import type { ActionIntelligenceSummary } from "@/lib/action-intelligence";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type TimeSortableMessage = InboxBucketMessage & {
  sender: string;
  subject: string;
  snippet: string;
  internalDateMs?: number;
  calendarIntentLevel?: "SCHEDULE_REQUIRED" | "SOFT_SCHEDULING" | "TIME_SENSITIVE" | "NO_TIME_CONTEXT";
  actionIntelligence?: ActionIntelligenceSummary;
  timeImpact?: TimeImpactResult;
};

function emotionalRank(message: TimeSortableMessage): number {
  const state = resolveInboxEmotionalState({
    category: message.category,
    actionIntelligence: message.actionIntelligence,
    calendarIntentLevel: message.calendarIntentLevel,
  });
  if (state === "action") return 0;
  if (state === "attention") return 1;
  return 2;
}

function sortKey(message: TimeSortableMessage): number {
  const impact =
    message.timeImpact ??
    classifyTimeImpact({
      row: message,
      category: message.category,
      actionIntelligence: message.actionIntelligence,
    });
  const emotional = emotionalRank(message);
  return impact.priorityScore * 10 - emotional;
}

function sortList<T extends TimeSortableMessage>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const scoreDiff = sortKey(b) - sortKey(a);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.internalDateMs ?? 0) - (a.internalDateMs ?? 0);
  });
}

function enrichTimeImpact<T extends TimeSortableMessage>(list: T[]): T[] {
  return list.map((m) => {
    if (m.timeImpact) return m;
    return {
      ...m,
      timeImpact: classifyTimeImpact({
        row: m,
        category: m.category,
        actionIntelligence: m.actionIntelligence,
      }),
    };
  });
}

/**
 * Order inbox by: TIME BLOCKER → TIME SENSITIVE → ACTION FLOW → AWARENESS FLOW.
 * Replaces category-only ordering within each section list.
 */
export function applyTimeImpactOrderingToBuckets<T extends TimeSortableMessage>(
  buckets: InboxBuckets<T>,
): InboxBuckets<T> {
  const byCategory = { ...buckets.byCategory };
  const byCategoryAll = { ...buckets.byCategoryAll };

  for (const cat of Object.keys(byCategory)) {
    const list = byCategory[cat];
    if (list?.length) {
      byCategory[cat] = sortList(enrichTimeImpact(list));
    }
  }
  for (const cat of Object.keys(byCategoryAll)) {
    const list = byCategoryAll[cat];
    if (list?.length) {
      byCategoryAll[cat] = sortList(enrichTimeImpact(list));
    }
  }

  const allVisible = sortList(
    enrichTimeImpact(buckets.categoryOrder.flatMap((c) => byCategory[c] ?? [])),
  );

  return {
    ...buckets,
    byCategory,
    byCategoryAll,
    allVisible,
    needsAttentionEmails: byCategory.worth_your_attention ?? [],
    waitingOnEmails: [],
  };
}

/** Flat list sorted globally by time impact (for All tab stream mode). */
export function sortMessagesByTimeImpact<T extends TimeSortableMessage>(
  messages: T[],
): T[] {
  return sortList(enrichTimeImpact(messages));
}
