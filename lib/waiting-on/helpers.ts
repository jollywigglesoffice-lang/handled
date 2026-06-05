import type { EmailCompletionMap, EmailCompletionRecord } from "@/lib/email-completions/types";

const MS_PER_DAY = 86_400_000;

export function isWaitingCompletion(record: EmailCompletionRecord): boolean {
  return record.actionId === "waiting_on_someone";
}

export function isActiveWaiting(record: EmailCompletionRecord): boolean {
  return isWaitingCompletion(record) && record.waitingResolvedAt == null;
}

export function activeWaitingRecords(completions: EmailCompletionMap): EmailCompletionRecord[] {
  return Object.values(completions)
    .filter(isActiveWaiting)
    .sort((a, b) => b.completedAt - a.completedAt);
}

export function daysWaiting(record: EmailCompletionRecord, now = Date.now()): number {
  const anchor = record.stillWaitingAt ?? record.completedAt;
  return Math.max(0, Math.floor((now - anchor) / MS_PER_DAY));
}

export function waitingOnLabel(record: EmailCompletionRecord, locale: "en" | "it"): string {
  if (record.waitingOn?.trim()) return record.waitingOn.trim();
  return locale === "it" ? "Qualcuno" : "Someone";
}

export function daysWaitingLabel(days: number, locale: "en" | "it"): string {
  if (locale === "it") {
    return days === 1 ? "1 giorno in attesa" : `${days} giorni in attesa`;
  }
  return days === 1 ? "1 day waiting" : `${days} days waiting`;
}

export function followUpLabel(record: EmailCompletionRecord, locale: "en" | "it", now = Date.now()): string | null {
  if (!record.followUpAt) return null;
  const daysUntil = Math.ceil((record.followUpAt - now) / MS_PER_DAY);
  if (daysUntil > 1) {
    return locale === "it" ? `Follow-up tra ${daysUntil} giorni` : `Follow up in ${daysUntil} days`;
  }
  if (daysUntil === 1) {
    return locale === "it" ? "Follow-up domani" : "Follow up tomorrow";
  }
  if (daysUntil === 0) {
    return locale === "it" ? "Follow-up oggi" : "Follow up today";
  }
  const overdue = Math.abs(daysUntil);
  return locale === "it"
    ? `Follow-up scaduto da ${overdue} giorn${overdue === 1 ? "o" : "i"}`
    : `Follow-up overdue by ${overdue} day${overdue === 1 ? "" : "s"}`;
}

export function buildWaitingActionLabel(waitingOn: string | undefined, locale: "en" | "it"): string {
  const who = waitingOn?.trim();
  if (!who) return locale === "it" ? "In attesa" : "Waiting on someone";
  return locale === "it" ? `In attesa di ${who}` : `Waiting on ${who}`;
}

export function computeFollowUpAt(completedAt: number, followUpAfterDays?: number): number | undefined {
  if (!followUpAfterDays || followUpAfterDays <= 0) return undefined;
  return completedAt + followUpAfterDays * MS_PER_DAY;
}
