import type { GmailInboxRow } from "@/lib/gmail-api";

/** Broadcast / FYI mail — never treat as a personal action request. */
export function isAnnouncementEmail(hay: string): boolean {
  return (
    /\b(announcement|announcing|all[- ]?hands|staff meeting|team meeting|company update|company-wide|org update|department update|newsletter|digest|bulletin|for your information|fyi\b|please note|reminder:|save the date|join us for|upcoming event|town hall|informativa|comunicazione|circolare|avviso generale|comunicato|aggiornamento (?:del |della )?(?:team|staff|azienda))\b/i.test(
      hay,
    ) ||
    /\b(this (?:email|message) is to (?:inform|notify|announce)|we(?:'re| are) (?:pleased|excited) to announce)\b/i.test(
      hay,
    )
  );
}

/** Vague meeting language — suggest reply, never open slot picker. */
export function hasSoftSchedulingIntent(hay: string): boolean {
  if (isAnnouncementEmail(hay) || hasExplicitSchedulingRequest(hay)) return false;
  return (
    /\b(?:can we meet|let['']?s meet|find a time|grab (?:a )?(?:coffee|lunch)|quick call|jump on a call|when are you (?:free|available)|what time works|meet (?:this|next) week|possiamo incontrarci|quando sei libero|quando sei disponibile)\b/i.test(
      hay,
    )
  );
}

/** Explicit scheduling request — schedule/book/set meeting/invite only. */
export function hasExplicitSchedulingRequest(hay: string): boolean {
  if (isAnnouncementEmail(hay)) return false;
  return (
    /\b(?:please\s+)?(?:schedule|book|set up|set)\s+(?:a |an )?(?:call|meeting|time|appointment|slot)\b/i.test(
      hay,
    ) ||
    /\b(?:please\s+)?book\s+(?:a |an )?(?:time|slot|meeting|appointment)\b/i.test(hay) ||
    /\b(?:calendar invite|send (?:me )?(?:a |an )?invite|invito calendario)\b/i.test(hay) ||
    /\b(?:reschedule|re-?schedule|postpone (?:the )?meeting|move (?:the )?meeting)\b/i.test(
      hay,
    ) ||
    /\b(?:fissare un (?:incontro|appuntamento)|prenotare un appuntamento|riprenotare|spostare (?:la )?riunione)\b/i.test(
      hay,
    )
  );
}

/** Direct question mark or explicit ask phrasing. */
export function hasExplicitQuestion(hay: string): boolean {
  if (isAnnouncementEmail(hay)) return false;
  return (
    /\?/.test(hay) ||
    /\b(could you|can you|would you|do you have|please (?:confirm|reply|respond|let me know)|waiting for your (?:reply|response)|ti chiedo|potresti|puoi|per favore confermi|fammi sapere)\b/i.test(
      hay,
    )
  );
}

/** Explicit deadline language in the message body. */
export function hasExplicitDeadline(hay: string): boolean {
  if (isAnnouncementEmail(hay)) return false;
  return /\b(deadline|due (?:by|on|before)|by (?:eod|cob|tomorrow|friday|monday|end of (?:day|week))|entro (?:venerdì|lunedì|domani|le)|scadenza|time.?sensitive)\b/i.test(
    hay,
  );
}

/** Explicit request for the recipient to do something. */
export function hasExplicitRequest(hay: string): boolean {
  if (isAnnouncementEmail(hay)) return false;
  return /\b(please|could you|can you|would you|need you to|action required|waiting for your|need your (?:approval|signature|decision|input)|richiesta|per favore|ti chiedo)\b/i.test(
    hay,
  );
}

export function hasExplicitMeetingLanguage(hay: string): boolean {
  return hasExplicitSchedulingRequest(hay);
}

export function rowHaystack(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): string {
  const base = `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
  return extraBody ? `${base} ${extraBody.toLowerCase()}` : base;
}

/** True when the email contains at least one explicit action trigger. */
export function hasExplicitActionTrigger(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): boolean {
  const hay = rowHaystack(row, extraBody);
  return (
    hasExplicitSchedulingRequest(hay) ||
    hasExplicitQuestion(hay) ||
    hasExplicitDeadline(hay) ||
    hasExplicitRequest(hay) ||
    /\b(please (?:approve|sign off)|need your approval|approval required|invoice|payment due|fattura|pagamento)\b/i.test(
      hay,
    )
  );
}
