import type { FollowUpReminderRecord } from "@/lib/follow-up/types";
import { FOLLOW_UP_REMINDERS_STORAGE_KEY } from "@/lib/follow-up-reminders/storage";

export function loadClientFollowUpReminders(): FollowUpReminderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FOLLOW_UP_REMINDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FollowUpReminderRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveClientFollowUpReminders(records: FollowUpReminderRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOLLOW_UP_REMINDERS_STORAGE_KEY, JSON.stringify(records));
}

export function upsertClientFollowUpReminder(record: FollowUpReminderRecord): void {
  const list = loadClientFollowUpReminders().filter((r) => r.emailId !== record.emailId);
  saveClientFollowUpReminders([record, ...list]);
}

export function patchClientFollowUpReminder(
  emailId: string,
  patch: Partial<Pick<FollowUpReminderRecord, "status" | "snoozedUntil">>,
): void {
  const list = loadClientFollowUpReminders().map((r) =>
    r.emailId === emailId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r,
  );
  saveClientFollowUpReminders(list);
}
