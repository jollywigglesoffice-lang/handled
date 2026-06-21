/** How an email relates to the user's calendar and clock. */
export type TimeImpactKind = "time_blocker" | "time_sensitive" | "time_free";

/** Inbox flow band — pairs with emotional state system. */
export type InboxFlowBand = "action_flow" | "awareness_flow";

/** Horizon for the Time Strip summary. */
export type TimeStripBand = "today" | "tomorrow" | "this_week" | "later";

export type TimeImpactResult = {
  kind: TimeImpactKind;
  flowBand: InboxFlowBand;
  /** When this item should surface on the Time Strip (null = not shown). */
  timeBand: TimeStripBand | null;
  /** Higher = earlier in inbox. */
  priorityScore: number;
  /** Human hint e.g. "by Friday", "tomorrow" */
  deadlineHint?: string;
};

export type SuggestedTimeSlot = {
  id: string;
  /** ISO start */
  start: string;
  /** ISO end */
  end: string;
  label: string;
  /** True when slot overlaps a busy calendar block */
  hasConflict: boolean;
  /** Alternative slot when hasConflict — user can pick this instead */
  alternativeStart?: string;
  alternativeEnd?: string;
  alternativeLabel?: string;
};

export type CalendarAvailabilityResult = {
  timezone: string;
  slots: SuggestedTimeSlot[];
  busyBlocks: Array<{ start: string; end: string }>;
  /** User has Google OAuth with calendar scope. */
  calendarConnected: boolean;
  /** freeBusy call failed despite valid OAuth — show error, never guess slots. */
  calendarApiError?: boolean;
};

export type ScheduleAcceptResult = {
  ok: boolean;
  slot: SuggestedTimeSlot;
  draftReplySnippet: string;
  calendarEventCreated: boolean;
  message: string;
};
