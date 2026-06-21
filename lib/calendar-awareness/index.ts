export type {
  CalendarAwarenessFlags,
  CalendarConnectionStatus,
  CalendarIntentLevel,
  FutureCalendarAvailability,
  SchedulingIntentKind,
  SchedulingIntentResult,
} from "@/lib/calendar-awareness/types";

export {
  detectSoftSchedulingIntent,
} from "@/lib/calendar-awareness/detect-soft-scheduling";

export {
  classifyCalendarIntent,
  type ClassifyCalendarIntentInput,
} from "@/lib/calendar-awareness/classify-intent";

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
  connectGoogleCalendarViaOAuth,
  disconnectGoogleCalendarPlaceholder,
  fetchCalendarConnectionStatus,
  fetchFutureCalendarAvailability,
  isCalendarConnected,
  readCalendarConnectionState,
  syncCalendarConnectionFromApi,
  writeCalendarConnectionState,
  type CalendarConnectionState,
  type ConnectCalendarResult,
} from "@/lib/calendar-awareness/connection";

export {
  buildCalendarAwareness,
  enrichMessageWithCalendarAwareness,
  type MessageWithCalendarAwareness,
} from "@/lib/calendar-awareness/enrich";

export {
  buildSuggestedSlots,
  detectSlotConflicts,
  draftSchedulingReply,
  findFreeTimeSlots,
  findNextFreeAlternative,
} from "@/lib/calendar-awareness/slots";
