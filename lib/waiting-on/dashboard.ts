import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import type {
  WaitingDashboardItem,
  WaitingDashboardSummary,
  WaitingOnMetadata,
  WaitingOnMetadataMap,
  WaitingWorkflowStatus,
} from "@/lib/waiting-on/metadata-types";
import {
  daysWaiting,
  waitingOnLabel,
  waitingOpenRecords,
} from "@/lib/waiting-on/helpers";
import { isWaitingUrgent } from "@/lib/waiting-on/urgency";

const MS_PER_DAY = 86_400_000;

export function effectiveFollowUpAt(
  record: EmailCompletionRecord,
  metadata?: WaitingOnMetadata,
): number | undefined {
  return metadata?.followUpAt ?? record.followUpAt;
}

export function resolveWorkflowStatus(
  record: EmailCompletionRecord,
  metadata?: WaitingOnMetadata,
): WaitingWorkflowStatus {
  if (record.waitingResolvedAt != null) return "resolved";
  if (metadata?.workflowStatus === "followed_up" || metadata?.followedUpAt) {
    return "followed_up";
  }
  return metadata?.workflowStatus ?? "waiting";
}

export function isWaitingItemOverdue(
  record: EmailCompletionRecord,
  metadata?: WaitingOnMetadata,
  now = Date.now(),
): boolean {
  const days = daysWaiting(record, now);
  if (days >= 15) return true;
  const followUp = effectiveFollowUpAt(record, metadata);
  if (followUp != null && followUp < now) return true;
  return false;
}

export function buildWaitingDashboardItem(
  record: EmailCompletionRecord,
  metadata: WaitingOnMetadata | undefined,
  locale: "en" | "it",
  now = Date.now(),
): WaitingDashboardItem {
  const days = daysWaiting(record, now);
  return {
    emailId: record.emailId,
    subject: record.subject || "(no subject)",
    sender: record.sender,
    waitingOn: waitingOnLabel(record, locale),
    waitingSinceMs: record.stillWaitingAt ?? record.completedAt,
    daysWaiting: days,
    followUpAt: effectiveFollowUpAt(record, metadata),
    note: metadata?.note,
    workflowStatus: resolveWorkflowStatus(record, metadata),
    isOverdue: isWaitingItemOverdue(record, metadata, now),
    isUrgent: isWaitingUrgent(days),
  };
}

export function buildWaitingDashboardItems(
  completions: Record<string, EmailCompletionRecord>,
  metadataMap: WaitingOnMetadataMap,
  locale: "en" | "it",
  now = Date.now(),
): WaitingDashboardItem[] {
  return waitingOpenRecords(completions)
    .map((record) => buildWaitingDashboardItem(record, metadataMap[record.emailId], locale, now))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
}

export function computeWaitingDashboardSummary(
  items: WaitingDashboardItem[],
): WaitingDashboardSummary {
  if (items.length === 0) {
    return { total: 0, overdue: 0, longestDays: 0 };
  }
  return {
    total: items.length,
    overdue: items.filter((i) => i.isOverdue).length,
    longestDays: Math.max(...items.map((i) => i.daysWaiting)),
  };
}

export function followUpDueLabel(
  followUpAt: number | undefined,
  locale: "en" | "it",
  now = Date.now(),
): string | null {
  if (!followUpAt) return null;
  const daysUntil = Math.ceil((followUpAt - now) / MS_PER_DAY);
  if (locale === "it") {
    if (daysUntil > 1) return `Follow-up tra ${daysUntil} giorni`;
    if (daysUntil === 1) return "Follow-up domani";
    if (daysUntil === 0) return "Follow-up oggi";
    const overdue = Math.abs(daysUntil);
    return `Follow-up scaduto da ${overdue} giorn${overdue === 1 ? "o" : "i"}`;
  }
  if (daysUntil > 1) return `Follow-up due in ${daysUntil} days`;
  if (daysUntil === 1) return "Follow-up due tomorrow";
  if (daysUntil === 0) return "Follow-up due today";
  const overdue = Math.abs(daysUntil);
  return `Follow-up overdue by ${overdue} day${overdue === 1 ? "" : "s"}`;
}

export type WaitingBriefingLine = { id: string; label: string };

export function buildWaitingBriefingLines(
  summary: WaitingDashboardSummary,
  locale: "en" | "it",
): WaitingBriefingLine[] {
  if (summary.total === 0) return [];

  const lines: WaitingBriefingLine[] = [];

  if (locale === "it") {
    lines.push({
      id: "waiting_total",
      label:
        summary.total === 1
          ? "Stai aspettando 1 persona."
          : `Stai aspettando ${summary.total} persone.`,
    });
    if (summary.overdue > 0) {
      lines.push({
        id: "waiting_overdue",
        label:
          summary.overdue === 1
            ? "1 voce è scaduta."
            : `${summary.overdue} voci sono scadute.`,
      });
    }
    if (summary.longestDays > 0) {
      lines.push({
        id: "waiting_longest",
        label: `Attesa più lunga: ${summary.longestDays} giorni.`,
      });
    }
  } else {
    lines.push({
      id: "waiting_total",
      label:
        summary.total === 1
          ? "You are waiting on 1 person."
          : `You are waiting on ${summary.total} people.`,
    });
    if (summary.overdue > 0) {
      lines.push({
        id: "waiting_overdue",
        label:
          summary.overdue === 1 ? "1 item is overdue." : `${summary.overdue} items are overdue.`,
      });
    }
    if (summary.longestDays > 0) {
      lines.push({
        id: "waiting_longest",
        label: `Longest waiting item: ${summary.longestDays} days.`,
      });
    }
  }

  return lines;
}

export function workflowStatusLabel(
  status: WaitingWorkflowStatus,
  locale: "en" | "it",
): string {
  const labels = {
    en: { waiting: "Waiting", followed_up: "Followed Up", resolved: "Resolved" },
    it: { waiting: "In attesa", followed_up: "Follow-up inviato", resolved: "Risolta" },
  };
  return labels[locale][status];
}
