import type { FollowUpAnalysis, FollowUpInboxItem, FollowUpReminderRecord } from "@/lib/follow-up/types";

export function isReminderVisible(record: FollowUpReminderRecord): boolean {
  if (record.status === "dismissed" || record.status === "resolved") return false;
  if (record.status === "snoozed" && record.snoozedUntil) {
    return new Date(record.snoozedUntil).getTime() <= Date.now();
  }
  if (record.status === "snoozed") return false;
  return true;
}

/** Merge heuristic analysis with persisted reminder state. */
export function mergeFollowUpItems(
  analyses: FollowUpAnalysis[],
  persisted: FollowUpReminderRecord[],
): FollowUpInboxItem[] {
  const byEmail = new Map<string, FollowUpReminderRecord>();
  for (const p of persisted) byEmail.set(p.emailId, p);

  const items: FollowUpInboxItem[] = [];

  for (const analysis of analyses) {
    const record = byEmail.get(analysis.emailId);
    if (record?.status === "dismissed" || record?.status === "resolved") continue;
    if (record?.status === "snoozed" && record.snoozedUntil) {
      if (new Date(record.snoozedUntil).getTime() > Date.now()) continue;
    }

    items.push({
      ...analysis,
      reminderId: record?.id,
      status: record?.status ?? "active",
      snoozedUntil: record?.snoozedUntil ?? null,
    });
  }

  return items.sort((a, b) => b.urgencyScore - a.urgencyScore);
}
