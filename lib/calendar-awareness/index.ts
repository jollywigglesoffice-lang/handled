export type {
  CalendarAwarenessFlags,
  CalendarConnectionStatus,
  FutureCalendarAvailability,
  SchedulingIntentKind,
  SchedulingIntentResult,
} from "@/lib/calendar-awareness/types";

export {
  detectSchedulingIntent,
  hasSchedulingIntent,
  needsCalendarContextForMessage,
  schedulingHaystack,
} from "@/lib/calendar-awareness/detect-scheduling-intent";

export {
  CALENDAR_SAFETY_RULES,
  calendarContextBadgeHint,
  calendarContextBadgeLabel,
  expectedSchedulingAction,
  schedulingIntentSummary,
  schedulingReplyDirective,
} from "@/lib/calendar-awareness/safe-wording";

export {
  connectGoogleCalendarPlaceholder,
  disconnectGoogleCalendarPlaceholder,
  fetchFutureCalendarAvailability,
  isCalendarConnected,
  readCalendarConnectionState,
  writeCalendarConnectionState,
  type CalendarConnectionState,
  type ConnectCalendarResult,
} from "@/lib/calendar-awareness/connection";

export {
  buildCalendarAwareness,
  enrichMessageWithCalendarAwareness,
  type MessageWithCalendarAwareness,
} from "@/lib/calendar-awareness/enrich";
