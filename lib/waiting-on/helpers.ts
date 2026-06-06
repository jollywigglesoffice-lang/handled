import type { EmailCompletionMap, EmailCompletionRecord } from "@/lib/email-completions/types";
import type { WaitingResolutionReason } from "@/lib/waiting-on/types";

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
    .sort((a, b) => daysWaiting(b) - daysWaiting(a));
}

export function waitingStartAt(record: EmailCompletionRecord): number {
  return record.stillWaitingAt ?? record.completedAt;
}

export function daysWaiting(record: EmailCompletionRecord, now = Date.now()): number {
  return Math.max(0, Math.floor((now - waitingStartAt(record)) / MS_PER_DAY));
}

export function waitingOnLabel(record: EmailCompletionRecord, locale: "en" | "it"): string {
  if (record.waitingOn?.trim()) return record.waitingOn.trim();
  return locale === "it" ? "Qualcuno" : "Someone";
}

export function daysWaitingLabel(days: number, locale: "en" | "it"): string {
  if (locale === "it") {
    return days === 1 ? "In attesa da 1 giorno" : `In attesa da ${days} giorni`;
  }
  return days === 1 ? "Waiting 1 day" : `Waiting ${days} days`;
}

export function formatWaitingStartedDate(
  record: EmailCompletionRecord,
  locale: "en" | "it",
): string {
  const d = new Date(waitingStartAt(record));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "it" ? "it-IT" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function startedOnLabel(record: EmailCompletionRecord, locale: "en" | "it"): string {
  const date = formatWaitingStartedDate(record, locale);
  if (!date) return "";
  return locale === "it" ? `Iniziato il ${date}` : `Started ${date}`;
}

/** @deprecated Reminders UI not shipped — kept for stored followUpAt data. */
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

export function buildResolvedWaitingLabel(
  record: EmailCompletionRecord,
  reason: WaitingResolutionReason,
  locale: "en" | "it",
): string {
  const who = record.waitingOn?.trim();
  if (reason === "received_response") {
    if (who) {
      return locale === "it" ? `Risposta da ${who}` : `Received response from ${who}`;
    }
    return locale === "it" ? "Risposta ricevuta" : "Received response";
  }
  if (who) {
    return locale === "it" ? `Non più in attesa di ${who}` : `No longer waiting on ${who}`;
  }
  return locale === "it" ? "Non più in attesa" : "No longer waiting";
}

export function computeFollowUpAt(completedAt: number, followUpAfterDays?: number): number | undefined {
  if (!followUpAfterDays || followUpAfterDays <= 0) return undefined;
  return completedAt + followUpAfterDays * MS_PER_DAY;
}
