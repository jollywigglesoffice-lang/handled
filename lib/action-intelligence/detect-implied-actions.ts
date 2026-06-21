import { analyzeEmailIntent } from "@/lib/email-intent";
import {
  hasExplicitActionTrigger,
  hasExplicitDeadline,
  hasExplicitQuestion,
  hasExplicitRequest,
  hasExplicitSchedulingRequest,
  isAnnouncementEmail,
  rowHaystack,
} from "@/lib/explicit-email-signals";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { ImpliedActionKind } from "@/lib/action-intelligence/types";

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
  const hay = rowHaystack(row, extraBody);
  const kinds = new Set<ImpliedActionKind>();

  if (isAnnouncementEmail(hay)) {
    return [];
  }

  if (hasExplicitQuestion(hay) || (hasExplicitRequest(hay) && /\?/.test(hay))) {
    kinds.add("reply_needed");
  } else if (hasExplicitRequest(hay) && WAITING_ON_YOU.test(hay)) {
    kinds.add("reply_needed");
  }

  const intent = analyzeEmailIntent(row as GmailInboxRow);
  if (intent.kinds.includes("decision_required") && hasExplicitRequest(hay)) {
    kinds.add("approval");
    kinds.add("review");
  }
  if ((intent.kinds.includes("deadline") || hasExplicitDeadline(hay)) && hasExplicitDeadline(hay)) {
    kinds.add("deadline");
  }
  if (intent.kinds.includes("urgent_request") && URGENT.test(hay)) {
    kinds.add("urgent");
  }
  if (hasExplicitSchedulingRequest(hay)) {
    kinds.add("scheduling");
    kinds.add("meeting");
  }

  if (SEND_FILE.test(hay) && hasExplicitRequest(hay)) kinds.add("send_file");
  if (FOLLOW_UP.test(hay)) kinds.add("follow_up");
  if (WAITING_ON_THEM.test(hay)) kinds.add("waiting_on_them");
  if (WAITING_ON_YOU.test(hay)) kinds.add("waiting_on_you");
  if (PAYMENT.test(hay)) kinds.add("payment");
  if (REMINDER.test(hay) && hasExplicitRequest(hay)) kinds.add("reminder");
  if (APPROVAL.test(hay)) kinds.add("approval");
  if (REVIEW.test(hay) && hasExplicitRequest(hay)) kinds.add("review");
  if (CONFIRM_MEETING.test(hay)) kinds.add("meeting");
  if (URGENT.test(hay) && hasExplicitDeadline(hay)) kinds.add("urgent");

  if (kinds.has("waiting_on_you") && !kinds.has("reply_needed") && hasExplicitRequest(hay)) {
    kinds.add("reply_needed");
  }

  return [...kinds];
}

export function isActionableEmail(
  implied: ImpliedActionKind[],
  category?: string,
  row?: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): boolean {
  if (implied.length === 0) return false;
  if (row && !hasExplicitActionTrigger(row, extraBody)) return false;

  if (category === "promotions" || category === "newsletters") {
    return implied.some(
      (k) =>
        k === "payment" ||
        k === "deadline" ||
        k === "urgent" ||
        k === "approval",
    );
  }
  return true;
}
