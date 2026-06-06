import type { CompletionActionCatalog } from "@/lib/completion-actions/catalog";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { EmailCompletionMap, EmailCompletionRecord } from "@/lib/email-completions/types";
import { isActiveWaiting } from "@/lib/waiting-on/helpers";

export type CompletionActionFilter = "all" | CompletionActionId;

export function completionRecordsSorted(completions: EmailCompletionMap): EmailCompletionRecord[] {
  return Object.values(completions).sort((a, b) => b.completedAt - a.completedAt);
}

/** Completed history — excludes emails still in Waiting On. */
export function completedHistoryRecords(completions: EmailCompletionMap): EmailCompletionRecord[] {
  return Object.values(completions)
    .filter((record) => !isActiveWaiting(record))
    .sort((a, b) => (b.waitingResolvedAt ?? b.completedAt) - (a.waitingResolvedAt ?? a.completedAt));
}

export function countCompletionsByAction(
  completions: EmailCompletionMap,
  options?: { excludeActiveWaiting?: boolean },
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of Object.values(completions)) {
    if (options?.excludeActiveWaiting && isActiveWaiting(record)) continue;
    counts[record.actionId] = (counts[record.actionId] ?? 0) + 1;
  }
  return counts;
}

/** Filter pills: system order + personal actions that have at least one completion. */
export function completionFiltersForView(
  completions: EmailCompletionMap,
  catalog: CompletionActionCatalog,
): CompletionActionId[] {
  const counts = countCompletionsByAction(completions, { excludeActiveWaiting: true });
  return catalog.pickerOrder.filter((id) => (counts[id] ?? 0) > 0);
}

export function filterCompletionRecords(
  records: EmailCompletionRecord[],
  filter: CompletionActionFilter,
  query: string,
): EmailCompletionRecord[] {
  const q = query.trim().toLowerCase();
  return records.filter((record) => {
    if (filter !== "all" && record.actionId !== filter) return false;
    if (!q) return true;
    const hay = `${record.sender} ${record.subject} ${record.snippet ?? ""} ${record.actionLabel}`.toLowerCase();
    return hay.includes(q);
  });
}
