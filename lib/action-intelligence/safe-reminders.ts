import type {
  ImpliedActionKind,
  SafeReminderSuggestion,
  TaskAwarenessItem,
} from "@/lib/action-intelligence/types";

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function inDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/**
 * Suggest at most one calm reminder — never auto-scheduled or auto-sent.
 */
export function buildSafeReminders(input: {
  implied: ImpliedActionKind[];
  taskAwareness: TaskAwarenessItem[];
  locale?: "en" | "it";
}): SafeReminderSuggestion[] {
  const locale = input.locale ?? "en";
  const reminders: SafeReminderSuggestion[] = [];
  const dateItem = input.taskAwareness.find((t) => t.kind === "date");

  if (input.implied.includes("deadline") && dateItem?.when) {
    reminders.push({
      id: "deadline-nudge",
      kind: "deadline",
      requiresUserApproval: true,
      suggestedAt: tomorrowIso(),
      message:
        locale === "it"
          ? `Promemoria suggerito: controlla la scadenza (${dateItem.when}) — solo se vuoi impostarlo.`
          : `Suggested reminder: check the deadline (${dateItem.when}) — only if you choose to set it.`,
    });
    return reminders;
  }

  if (input.implied.includes("waiting_on_them") || input.implied.includes("follow_up")) {
    reminders.push({
      id: "follow-up-nudge",
      kind: "follow_up",
      requiresUserApproval: true,
      suggestedAt: inDaysIso(2),
      message:
        locale === "it"
          ? "Suggerimento: un follow-up leggero tra un paio di giorni — tu decidi se impostarlo."
          : "Suggestion: a gentle follow-up in a couple of days — you decide whether to set it.",
    });
    return reminders;
  }

  if (input.implied.includes("reply_needed")) {
    reminders.push({
      id: "reply-nudge",
      kind: "reply",
      requiresUserApproval: true,
      suggestedAt: tomorrowIso(),
      message:
        locale === "it"
          ? "Suggerimento: rispondi quando hai un momento — nessun invio automatico."
          : "Suggestion: reply when you have a moment — Handled never sends automatically.",
    });
  }

  return reminders.slice(0, 1);
}

export const REMINDER_SAFETY_NOTE_EN =
  "Reminders are suggestions only. Handled never sends emails or completes actions for you.";

export const REMINDER_SAFETY_NOTE_IT =
  "I promemoria sono solo suggerimenti. Handled non invia email né completa azioni al posto tuo.";
