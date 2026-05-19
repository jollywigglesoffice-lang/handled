import type { GmailInboxRow } from "@/lib/gmail-api";
import type { SchedulingIntentKind, SchedulingIntentResult } from "@/lib/calendar-awareness/types";

type PatternRule = {
  kind: SchedulingIntentKind;
  pattern: RegExp;
  phrase: string;
};

/** EN + IT scheduling phrases — centralized for inbox, replies, and follow-ups */
const SCHEDULING_PATTERNS: PatternRule[] = [
  {
    kind: "availability_request",
    pattern:
      /\b(are you (?:free|available)|when (?:are you|can you be) (?:free|available)|what times? (?:work|are good)|do you have (?:any )?(?:time|availability)|when can (?:we|you)|quando (?:sei|saresti) (?:liber[oa]|disponibil[ei])|hai (?:tempo|disponibilità)|when works for you)\b/i,
    phrase: "availability",
  },
  {
    kind: "meeting_request",
    pattern:
      /\b(meeting|meet(?:ing)?\s+(?:request|invite)|call|zoom|teams|google meet|video call|riunione|incontro|chiamata|videocall)\b/i,
    phrase: "meeting",
  },
  {
    kind: "appointment_request",
    pattern:
      /\b(appointment|book (?:a |an )?(?:time|slot|appointment)|schedule (?:a |an )?(?:call|meeting|time)|set up a (?:call|meeting)|appuntamento|prenotare|fissare un appuntamento)\b/i,
    phrase: "appointment",
  },
  {
    kind: "calendar_reference",
    pattern:
      /\b(calendar|google calendar|outlook calendar|invite|calendar invite|calendario|invito calendario|add to (?:my |your )?calendar)\b/i,
    phrase: "calendar",
  },
  {
    kind: "reschedule",
    pattern:
      /\b(reschedule|re-?schedule|move (?:the )?meeting|postpone|spostare (?:la )?riunione|rimandare|cambiare l'?orario)\b/i,
    phrase: "reschedule",
  },
  {
    kind: "availability_request",
    pattern: /\b(when can we|can we meet|free to meet|find a time|pick a time|trova un orario)\b/i,
    phrase: "when can we",
  },
];

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

  const detected = kinds.size > 0;
  const needsCalendarContext =
    detected &&
    (kinds.has("availability_request") ||
      kinds.has("meeting_request") ||
      kinds.has("appointment_request") ||
      kinds.has("reschedule"));

  const confidence = Math.min(
    0.96,
    0.62 + matchedPhrases.length * 0.1 + (needsCalendarContext ? 0.12 : 0),
  );

  return {
    detected,
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
