/**
 * Google Calendar integration — types and future API surface.
 * No auto-booking or auto-send; user approval required for all scheduling actions.
 */

export type CalendarConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type SchedulingIntentKind =
  | "availability_request"
  | "meeting_request"
  | "appointment_request"
  | "calendar_reference"
  | "reschedule";

export type SchedulingIntentResult = {
  /** Any scheduling-related language detected */
  detected: boolean;
  /** True when reply generation should eventually read Google Calendar */
  needsCalendarContext: boolean;
  kinds: SchedulingIntentKind[];
  matchedPhrases: string[];
  confidence: number;
  /** Always true — Handled must not confirm times without explicit user approval */
  requiresUserApproval: true;
};

/** Future: free/busy and suggested slots from Google Calendar API */
export type FutureCalendarAvailability = {
  timezone?: string;
  /** ISO date-time strings the user is free (future) */
  suggestedSlots?: string[];
  /** Human-readable summary for draft replies (future) */
  summaryForDraft?: string;
};

export type CalendarAwarenessFlags = {
  schedulingIntent: SchedulingIntentResult;
  needsCalendarContext: boolean;
  calendarConnected: boolean;
};
