import { isCalendarConnected } from "@/lib/calendar-awareness/connection";
import { detectSchedulingIntent } from "@/lib/calendar-awareness/detect-scheduling-intent";
import type { CalendarAwarenessFlags } from "@/lib/calendar-awareness/types";
import type { GmailInboxRow } from "@/lib/gmail-api";

export function buildCalendarAwareness(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): CalendarAwarenessFlags {
  const schedulingIntent = detectSchedulingIntent(row, extraBody);
  return {
    schedulingIntent,
    needsCalendarContext: schedulingIntent.needsCalendarContext,
    calendarConnected: isCalendarConnected(),
  };
}

export type MessageWithCalendarAwareness<T> = T & {
  needsCalendarContext?: boolean;
  schedulingIntentDetected?: boolean;
};

/** Attach calendar flags for API responses and inbox UI */
export function enrichMessageWithCalendarAwareness<
  T extends Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
>(row: T, extraBody?: string): MessageWithCalendarAwareness<T> {
  const awareness = buildCalendarAwareness(row, extraBody);
  return {
    ...row,
    needsCalendarContext: awareness.needsCalendarContext,
    schedulingIntentDetected: awareness.schedulingIntent.detected,
  };
}
