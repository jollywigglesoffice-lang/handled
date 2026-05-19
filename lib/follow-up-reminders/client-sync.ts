import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { FollowUpReminderRecord, FollowUpReminderStatus } from "@/lib/follow-up/types";
import {
  loadClientFollowUpReminders,
  patchClientFollowUpReminder,
  saveClientFollowUpReminders,
  upsertClientFollowUpReminder,
} from "@/lib/follow-up-reminders/client-storage";

export async function syncFollowUpRemindersFromAccount(): Promise<FollowUpReminderRecord[]> {
  if (typeof window === "undefined") return [];

  try {
    const res = await fetch("/api/follow-ups", { credentials: "same-origin" });
    const data = (await res.json()) as { reminders?: FollowUpReminderRecord[] };
    if (res.ok && Array.isArray(data.reminders)) {
      saveClientFollowUpReminders(data.reminders);
      return data.reminders;
    }
  } catch {
    // offline
  }
  return loadClientFollowUpReminders();
}

export async function saveFollowUpReminderToAccount(
  analysis: FollowUpAnalysis,
): Promise<{ ok: boolean; record?: FollowUpReminderRecord }> {
  const optimistic: FollowUpReminderRecord = {
    id: `local-${analysis.emailId}`,
    emailId: analysis.emailId,
    conversationState: analysis.state,
    urgencyScore: analysis.urgencyScore,
    reminderTitle: analysis.headline,
    reminderBody: analysis.calmPrompt,
    status: "active",
    snoozedUntil: null,
    analysis,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  upsertClientFollowUpReminder(optimistic);

  try {
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis }),
    });
    const data = (await res.json()) as { reminder?: FollowUpReminderRecord };
    if (res.ok && data.reminder) {
      upsertClientFollowUpReminder(data.reminder);
      return { ok: true, record: data.reminder };
    }
  } catch {
    return { ok: false, record: optimistic };
  }
  return { ok: false, record: optimistic };
}

export async function patchFollowUpReminderOnAccount(
  emailId: string,
  action: "snooze" | "dismiss" | "resolve",
  snoozeDays = 3,
): Promise<{ ok: boolean }> {
  const now = Date.now();
  const patch: { status: FollowUpReminderStatus; snoozedUntil: string | null } =
    action === "snooze"
      ? {
          status: "snoozed",
          snoozedUntil: new Date(now + snoozeDays * 24 * 60 * 60 * 1000).toISOString(),
        }
      : action === "dismiss"
        ? { status: "dismissed", snoozedUntil: null }
        : { status: "resolved", snoozedUntil: null };

  patchClientFollowUpReminder(emailId, patch);

  try {
    const res = await fetch("/api/follow-ups", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId, action, snoozeDays }),
    });
    if (res.ok) {
      const data = (await res.json()) as { reminder?: FollowUpReminderRecord };
      if (data.reminder) upsertClientFollowUpReminder(data.reminder);
      return { ok: true };
    }
  } catch {
    return { ok: false };
  }
  return { ok: false };
}
