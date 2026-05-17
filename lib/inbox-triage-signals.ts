import type { GmailInboxRow } from "@/lib/gmail-api";
import { computeInboxRuleScores, isBillingLikely } from "@/lib/inbox-rule-classify";

const BULK_SENDER =
  /instagram|facebookmail|mail\.instagram|meta\.com|linkedin|twitter|x\.com|tiktok|pinterest|snapchat|shopify|mailchimp|sendgrid|amazonses|beehiiv|substack|youtube|discord|noreply|no-reply|donotreply|notifications?@|updates@|marketing@|promo@|newsletter/i;

const MARKETING_COPY =
  /unsubscribe|opt\s*out|view\s+in\s+browser|email\s+preferences|manage\s+(your\s+)?preferences|%\s*off|\d+%\s*off|\d+%\s+discount|10%\s+discount|limited\s+time|flash\s+sale|shop\s+now|order\s+now|add\s+to\s+cart|free\s+shipping|promo\s+code|sponsored|act\s+now|weekly\s+digest|daily\s+digest|mailing\s+list|you\s+have\s+\d+\s+new\s+(likes|followers|notifications)|mentioned\s+you|liked\s+your|commented\s+on|new\s+notifications?|\$\d+k\/yr|book\s+sales|passive\s+income|make\s+money|affiliate|exclusive\s+offer|creator\s+funnel|join\s+the\s+waitlist|enroll\s+now|webinar|masterclass/i;

const TRANSACTIONAL_COPY =
  /order\s+confirmed|payment\s+received|receipt|tracking\s+(number|#|link)|shipment|has\s+shipped|out\s+for\s+delivery|delivered|invoice|charged|subscription\s+renewed|amount\s+due|payment\s+due|billing\s+statement|your\s+bill/i;

const URGENT_HUMAN =
  /please\s+(confirm|review|approve|sign)|need\s+your\s+(approval|signature|response)|action\s+required|by\s+(eod|cob|tomorrow|friday|monday)|deadline|urgent|asap|waiting\s+for\s+your|could\s+you|can\s+you|would\s+you|let\s+me\s+know|following\s+up|follow\s+up|reply\s+needed|requires\s+your\s+attention/i;

export function emailHaystack(row: GmailInboxRow): string {
  return `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
}

export function isCommercialBulk(row: GmailInboxRow): boolean {
  const hay = emailHaystack(row);
  const sender = row.sender.toLowerCase();

  if (isBillingLikely(row) && TRANSACTIONAL_COPY.test(hay)) {
    return false;
  }

  if (BULK_SENDER.test(sender) || BULK_SENDER.test(hay)) {
    return true;
  }

  if (MARKETING_COPY.test(hay)) {
    return true;
  }

  const scores = computeInboxRuleScores(row);
  if (Math.max(scores.promotion, scores.newsletter) >= 1.5) {
    return true;
  }

  return false;
}

export function isTransactionalFyi(row: GmailInboxRow): boolean {
  if (isBillingLikely(row)) return true;
  return TRANSACTIONAL_COPY.test(emailHaystack(row));
}

/** True when the email likely needs a real human decision (not just marketing noise). */
export function hasUrgentHumanSignal(row: GmailInboxRow): boolean {
  const hay = emailHaystack(row);
  const sender = row.sender.toLowerCase();

  if (isCommercialBulk(row) && !URGENT_HUMAN.test(hay)) {
    return false;
  }

  if (URGENT_HUMAN.test(hay)) {
    return true;
  }

  if (/^re:\s/i.test(row.subject) && !/noreply|no-reply|donotreply|notifications?@/i.test(sender)) {
    return true;
  }

  const personalName = /^[A-Za-zÀ-ÿ][\w.'-]*\s+[A-Za-zÀ-ÿ]/.test(row.sender.trim());
  const hasQuestion = /\?/.test(hay);
  if (personalName && hasQuestion && !BULK_SENDER.test(sender)) {
    return true;
  }

  return false;
}
