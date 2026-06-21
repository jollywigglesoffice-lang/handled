import { detectSchedulingIntent } from "@/lib/calendar-awareness/detect-scheduling-intent";
import { detectSoftSchedulingIntent } from "@/lib/calendar-awareness/detect-soft-scheduling";
import type { CalendarIntentLevel } from "@/lib/calendar-awareness/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { TimeImpactKind } from "@/lib/time-impact/types";

const DEADLINE_HAY =
  /\b(by (?:eod|cob|end of day|tomorrow|today|friday|monday|tuesday|wednesday|thursday|saturday|sunday)|due (?:on|by)|deadline|entro (?:domani|venerdì|lunedì)|scadenza|time.?sensitive|asap|urgent)\b/i;

export type ClassifyCalendarIntentInput = {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  extraBody?: string;
  needsCalendarContext?: boolean;
  timeImpactKind?: TimeImpactKind;
};

/**
 * Four-tier calendar intent for embedded scheduling UX.
 * SCHEDULE_REQUIRED → full inline scheduling panel (explicit intent only)
 * SOFT_SCHEDULING → quiet nudge, no slot picker
 * TIME_SENSITIVE → deadline awareness, no slot picker
 * NO_TIME_CONTEXT → no calendar UI
 */
export function classifyCalendarIntent(
  input: ClassifyCalendarIntentInput,
): CalendarIntentLevel {
  const scheduling = detectSchedulingIntent(input.row, input.extraBody);

  if (scheduling.needsCalendarContext) {
    return "SCHEDULE_REQUIRED";
  }

  if (detectSoftSchedulingIntent(input.row, input.extraBody)) {
    return "SOFT_SCHEDULING";
  }

  const hay = `${input.row.sender} ${input.row.subject} ${input.row.snippet ?? ""} ${
    input.extraBody ?? ""
  }`.toLowerCase();

  if (
    input.timeImpactKind === "time_sensitive" ||
    input.timeImpactKind === "time_blocker" ||
    DEADLINE_HAY.test(hay)
  ) {
    return "TIME_SENSITIVE";
  }

  return "NO_TIME_CONTEXT";
}
