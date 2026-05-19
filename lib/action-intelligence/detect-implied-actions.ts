import { needsCalendarContextForMessage } from "@/lib/calendar-awareness";
import { analyzeEmailIntent } from "@/lib/email-intent";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { ImpliedActionKind } from "@/lib/action-intelligence/types";

function haystack(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): string {
  const base = `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
  return extraBody ? `${base} ${extraBody.toLowerCase()}` : base;
}

const SEND_FILE =
  /\b(send (?:me )?(?:the |a )?(?:file|document|attachment|pdf|spreadsheet|deck)|attach(?:ed|ment)?|please (?:send|share) (?:the |a )?|invia(?:re)? (?:il |la )?(?:file|documento|allegato)|allega(?:re)?)\b/i;

const FOLLOW_UP =
  /\b(follow(?:-| )?up|following up|checking in|check(?:ing)? back|any update|bump(?:ing)? this|just (?:wanted to )?check|ricontatt(?:are|o)|sollecito)\b/i;

const WAITING_ON_THEM =
  /\b(waiting (?:for|on) (?:your |a )?response|haven'?t heard|have not heard|still waiting (?:for|on) (?:you|your)|awaiting your (?:reply|response))\b/i;

const WAITING_ON_YOU =
  /\b(waiting (?:for|on) (?:my |our )|awaiting (?:my |our )|in attesa di (?:una )?risposta|aspetto (?:una )?risposta)\b/i;

const PAYMENT =
  /\b(invoice|payment due|amount due|pay(?:ment)? request|billing statement|fattura|pagamento|bolletta|scadenza pagamento|wire transfer)\b/i;

const DEADLINE =
  /\b(deadline|due (?:by|on|before)|by (?:eod|cob|tomorrow|friday|monday|end of (?:day|week))|entro (?:venerdì|lunedì|domani)|scadenza|time.?sensitive)\b/i;

const REMINDER =
  /\b(reminder|friendly reminder|just a reminder|promemoria|ti ricordo)\b/i;

const APPROVAL =
  /\b(please (?:approve|sign off)|need your (?:approval|signature)|approval required|awaiting approval|approvazione|firma richiesta)\b/i;

const REVIEW =
  /\b(please (?:review|read)|need your (?:review|feedback)|take a look|review (?:and|&) (?:approve|comment)|revisione|leggi (?:e )?conferma)\b/i;

const CONFIRM_MEETING =
  /\b(confirm(?:ing)? (?:the )?(?:meeting|call|time|appointment)|conferma(?:re)? (?:la )?(?:riunione|chiamata|appuntamento))\b/i;

const URGENT =
  /\b(urgent|asap|immediately|priority|urgente|subito|il prima possibile)\b/i;

export function detectImpliedActions(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): ImpliedActionKind[] {
  const hay = haystack(row, extraBody);
  const kinds = new Set<ImpliedActionKind>();
  const intent = analyzeEmailIntent(row as GmailInboxRow);

  if (intent.requiresReply || intent.kinds.includes("direct_question")) {
    kinds.add("reply_needed");
  }
  if (intent.kinds.includes("decision_required")) {
    kinds.add("approval");
    kinds.add("review");
  }
  if (intent.kinds.includes("deadline") || intent.kinds.includes("urgent_request")) {
    kinds.add("deadline");
  }
  if (intent.kinds.includes("urgent_request")) {
    kinds.add("urgent");
  }
  if (intent.kinds.includes("scheduling") || needsCalendarContextForMessage(row, extraBody)) {
    kinds.add("scheduling");
    kinds.add("meeting");
  }

  if (SEND_FILE.test(hay)) kinds.add("send_file");
  if (FOLLOW_UP.test(hay)) kinds.add("follow_up");
  if (WAITING_ON_THEM.test(hay)) kinds.add("waiting_on_them");
  if (WAITING_ON_YOU.test(hay)) kinds.add("waiting_on_you");
  if (PAYMENT.test(hay)) kinds.add("payment");
  if (DEADLINE.test(hay)) kinds.add("deadline");
  if (REMINDER.test(hay)) kinds.add("reminder");
  if (APPROVAL.test(hay)) kinds.add("approval");
  if (REVIEW.test(hay)) kinds.add("review");
  if (CONFIRM_MEETING.test(hay)) kinds.add("meeting");
  if (URGENT.test(hay)) kinds.add("urgent");

  if (kinds.has("waiting_on_you") && !kinds.has("reply_needed")) {
    kinds.add("reply_needed");
  }

  return [...kinds];
}

export function isActionableEmail(
  implied: ImpliedActionKind[],
  category?: string,
): boolean {
  if (category === "promotion" || category === "newsletter") {
    return implied.some(
      (k) =>
        k === "payment" ||
        k === "deadline" ||
        k === "urgent" ||
        k === "approval",
    );
  }
  return implied.length > 0;
}
