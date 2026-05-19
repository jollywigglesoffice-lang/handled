import type { CalendarConnectionStatus, SchedulingIntentResult } from "@/lib/calendar-awareness/types";

/** Core safety rule — injected into all scheduling-related reply prompts */
export const CALENDAR_SAFETY_RULES = `
CALENDAR SAFETY (mandatory):
- NEVER confirm the user is available, booked, or attending unless the user explicitly approved those exact times.
- NEVER send calendar invites or accept meetings on the user's behalf.
- NEVER state specific times as confirmed — only suggest draft wording the user can edit.
- If availability is unknown, use tentative language ("I can check my calendar and get back to you") or offer to propose options after the user reviews.
- Treat all scheduling drafts as proposals requiring user approval before send.
`.trim();

export function schedulingIntentSummary(
  intent: SchedulingIntentResult,
  locale: "en" | "it" = "en",
): string {
  if (!intent.detected) return "";
  const kinds = intent.kinds.map((k) => k.replace(/_/g, " ")).join(", ");
  if (locale === "it") {
    return intent.needsCalendarContext
      ? `Richiesta di programmazione (${kinds}) — serve il contesto del calendario.`
      : `Riferimento a calendario/riunione (${kinds}).`;
  }
  return intent.needsCalendarContext
    ? `Scheduling request (${kinds}) — calendar context will help draft a reply.`
    : `Scheduling-related message (${kinds}).`;
}

export function schedulingReplyDirective(
  intent: SchedulingIntentResult,
  calendarStatus: CalendarConnectionStatus,
): string {
  if (!intent.detected) return "";

  const connected = calendarStatus === "connected";
  const calendarLine = intent.needsCalendarContext
    ? connected
      ? "Google Calendar is connected (read-only for drafts). Use only times the user has approved; suggest slots as editable options, never as confirmed bookings."
      : "Google Calendar is NOT connected yet. Do NOT invent specific availability. Use tentative language and invite the user to pick or confirm times after reviewing their calendar."
    : "Scheduling tone: helpful and concrete, but do not confirm meetings without user approval.";

  return `
Scheduling intent detected: ${intent.kinds.join(", ") || "general"}.
${calendarLine}
${CALENDAR_SAFETY_RULES}
`.trim();
}

export function expectedSchedulingAction(
  intent: SchedulingIntentResult,
  calendarStatus: CalendarConnectionStatus,
): string {
  if (!intent.detected) {
    return "Continue the thread naturally.";
  }
  if (intent.needsCalendarContext && calendarStatus !== "connected") {
    return "Acknowledge the scheduling request. Offer to propose times after checking calendar — do not confirm specific slots yet.";
  }
  if (intent.kinds.includes("availability_request")) {
    return "Draft tentative availability options or ask which times work — user must approve before send.";
  }
  if (intent.kinds.includes("reschedule")) {
    return "Acknowledge reschedule request; propose alternatives as drafts only.";
  }
  return "Help coordinate a meeting with draft times or next steps — no auto-confirmation.";
}

export function calendarContextBadgeLabel(locale: "en" | "it" = "en"): string {
  return locale === "it" ? "Serve contesto calendario" : "Calendar context needed";
}

export function calendarContextBadgeHint(
  calendarStatus: CalendarConnectionStatus,
  locale: "en" | "it" = "en",
): string {
  if (calendarStatus === "connected") {
    return locale === "it"
      ? "Handled userà il calendario per suggerire orari in bozza — tu approvi prima dell'invio."
      : "Handled will use your calendar to suggest draft times — you approve before anything is sent.";
  }
  return locale === "it"
    ? "Collega Google Calendar nelle impostazioni per bozze con orari reali. Nessuna conferma automatica."
    : "Connect Google Calendar in Settings for real availability in drafts. Handled never confirms meetings without your approval.";
}
