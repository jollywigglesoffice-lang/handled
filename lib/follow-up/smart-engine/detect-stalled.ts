import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { analyzeEmailIntent } from "@/lib/email-intent";
import type { StalledConversationSignals } from "@/lib/follow-up/smart-engine/types";

const PROMISED_INFO_MISSING =
  /\b(as discussed|as promised|still waiting (?:for|on) (?:the|your)|never received|haven'?t received|didn'?t receive|non ho ricevuto|promised to send|said you(?:'|')?d send)\b/i;

const PENDING_CONFIRMATION =
  /\b(please confirm|awaiting confirmation|pending confirmation|waiting (?:for|on) confirmation|conferma(?:re)?|in attesa di conferma)\b/i;

const PENDING_APPROVAL =
  /\b(awaiting approval|pending approval|need your approval|waiting for (?:your )?approval|approval required|in attesa di approvazione)\b/i;

const PENDING_PAYMENT =
  /\b(payment due|invoice due|pending payment|awaiting payment|unpaid invoice|amount due|pagamento in sospeso|fattura)\b/i;

/** Heuristic: user may have sent last and is waiting (metadata-only inbox). */
const USER_SENT_WAITING =
  /\b(per my (?:last )?email|following up on my (?:email|message)|as per my email|just circling back|wanted to follow up on my|ti scrivo di nuovo|come da mia email)\b/i;

const BUSINESS_STALLED =
  /\b(pricing|proposal|demo|partnership|contract|quote|early access|opportunity)\b/i;

const CLOSED_SIGNALS =
  /\b(thank you for your (?:order|purchase)|receipt|no further action|case closed|resolved|unsubscribe)\b/i;

export function detectStalledSignals(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
): StalledConversationSignals {
  const hay = `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
  const intent = analyzeEmailIntent(row as GmailInboxRow);

  const waitingOnTheirReply =
    USER_SENT_WAITING.test(hay) ||
    /\b(any update|heard back|still waiting)\b/i.test(hay);

  return {
    waitingOnTheirReply,
    promisedInformationMissing: PROMISED_INFO_MISSING.test(hay),
    pendingConfirmation: PENDING_CONFIRMATION.test(hay),
    pendingApproval: PENDING_APPROVAL.test(hay) || intent.kinds.includes("decision_required"),
    pendingPayment: PENDING_PAYMENT.test(hay),
    userSentNoReplyHeuristic: USER_SENT_WAITING.test(hay),
    businessOpportunityStalled:
      BUSINESS_STALLED.test(hay) &&
      (waitingOnTheirReply || intent.kinds.includes("sales_lead")),
  };
}

export function isLikelyClosedConversation(
  hay: string,
  category: InboxAiCategory,
  days: number,
): boolean {
  if (category === "handled" && days >= 10 && CLOSED_SIGNALS.test(hay)) {
    return true;
  }
  if (category === "promotion" || category === "newsletter") {
    return true;
  }
  return false;
}
