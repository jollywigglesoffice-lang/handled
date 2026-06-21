import type { GmailInboxRow } from "@/lib/gmail-api";
import type { SchedulingIntentKind, SchedulingIntentResult } from "@/lib/calendar-awareness/types";
import {
  hasExplicitSchedulingRequest,
  isAnnouncementEmail,
} from "@/lib/explicit-email-signals";

type PatternRule = {
  kind: SchedulingIntentKind;
  pattern: RegExp;
  phrase: string;
};

/** Only explicit scheduling requests — no vague "can we meet" or availability asks. */
const SCHEDULING_PATTERNS: PatternRule[] = [
  {
    kind: "meeting_request",
    pattern:
      /\b(schedule (?:a |an )?(?:call|meeting|time)|book (?:a |an )?(?:time|slot|meeting|appointment)|set (?:up )?a (?:call|meeting)|set a meeting|fissare un (?:incontro|appuntamento)|prenotare un appuntamento)\b/i,
    phrase: "schedule meeting",
  },
  {
    kind: "appointment_request",
    pattern:
      /\b(book (?:a |an )?(?:appointment|time|slot)|schedule (?:a |an )?(?:appointment|time))\b/i,
    phrase: "book appointment",
  },
  {
    kind: "calendar_reference",
    pattern:
      /\b(calendar invite|send (?:me )?(?:a |an )?invite|invito calendario)\b/i,
    phrase: "calendar invite",
  },
  {
    kind: "reschedule",
    pattern:
      /\b(reschedule|re-?schedule|postpone (?:the )?meeting|move (?:the )?meeting|riprenotare|spostare (?:la )?riunione)\b/i,
    phrase: "reschedule",
  },
];

const EMPTY_RESULT: SchedulingIntentResult = {
  detected: false,
  needsCalendarContext: false,
  kinds: [],
  matchedPhrases: [],
  confidence: 0,
  requiresUserApproval: true,
};

export function schedulingHaystack(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): string {
  const base = `${row.sender} ${row.subject} ${row.snippet ?? ""}`;
  return extraBody ? `${base} ${extraBody}`.toLowerCase() : base.toLowerCase();
}

export function detectSchedulingIntent(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): SchedulingIntentResult {
  const hay = schedulingHaystack(row, extraBody);

  if (isAnnouncementEmail(hay) || !hasExplicitSchedulingRequest(hay)) {
    return EMPTY_RESULT;
  }

  const kinds = new Set<SchedulingIntentKind>();
  const matchedPhrases: string[] = [];

  for (const rule of SCHEDULING_PATTERNS) {
    if (rule.pattern.test(hay)) {
      kinds.add(rule.kind);
      if (!matchedPhrases.includes(rule.phrase)) {
        matchedPhrases.push(rule.phrase);
      }
    }
  }

  if (kinds.size === 0) {
    return {
      ...EMPTY_RESULT,
      detected: true,
      needsCalendarContext: true,
      kinds: ["meeting_request"],
      matchedPhrases: ["explicit scheduling"],
      confidence: 0.75,
    };
  }

  const needsCalendarContext = kinds.size > 0;
  const confidence = Math.min(0.96, 0.72 + matchedPhrases.length * 0.08);

  return {
    detected: true,
    needsCalendarContext,
    kinds: [...kinds],
    matchedPhrases,
    confidence,
    requiresUserApproval: true,
  };
}

export function hasSchedulingIntent(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): boolean {
  return detectSchedulingIntent(row, extraBody).detected;
}

export function needsCalendarContextForMessage(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): boolean {
  return detectSchedulingIntent(row, extraBody).needsCalendarContext;
}
