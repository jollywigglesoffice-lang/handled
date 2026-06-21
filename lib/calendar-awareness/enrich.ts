import { isCalendarConnected } from "@/lib/calendar-awareness/connection";
import { classifyCalendarIntent } from "@/lib/calendar-awareness/classify-intent";
import { detectSchedulingIntent } from "@/lib/calendar-awareness/detect-scheduling-intent";
import type { CalendarAwarenessFlags } from "@/lib/calendar-awareness/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { TimeImpactKind } from "@/lib/time-impact/types";

export function buildCalendarAwareness(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
  timeImpactKind?: TimeImpactKind,
): CalendarAwarenessFlags {
  const schedulingIntent = detectSchedulingIntent(row, extraBody);
  const needsCalendarContext = schedulingIntent.needsCalendarContext;
  const calendarIntentLevel = classifyCalendarIntent({
    row,
    extraBody,
    needsCalendarContext,
    timeImpactKind,
  });
  return {
    schedulingIntent,
    needsCalendarContext,
    calendarIntentLevel,
    calendarConnected: isCalendarConnected(),
  };
}

export type MessageWithCalendarAwareness<T> = T & {
  needsCalendarContext?: boolean;
  schedulingIntentDetected?: boolean;
  calendarIntentLevel?: CalendarAwarenessFlags["calendarIntentLevel"];
};

/** Attach calendar flags for API responses and inbox UI */
export function enrichMessageWithCalendarAwareness<
  T extends Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
>(row: T, extraBody?: string, timeImpactKind?: TimeImpactKind): MessageWithCalendarAwareness<T> {
  const awareness = buildCalendarAwareness(row, extraBody, timeImpactKind);
  return {
    ...row,
    needsCalendarContext: awareness.needsCalendarContext,
    schedulingIntentDetected: awareness.schedulingIntent.detected,
    calendarIntentLevel: awareness.calendarIntentLevel,
  };
}
