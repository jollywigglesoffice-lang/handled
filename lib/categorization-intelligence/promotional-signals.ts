import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { emailHaystack, emailText } from "@/lib/categorization-intelligence/priority-signals";

export type PromotionalSignalHit = {
  code: string;
  label: string;
  weight: number;
};

export type PromotionalAnalysis = {
  score: number;
  hits: PromotionalSignalHit[];
  isBulkMarketing: boolean;
  isNewsletterStyle: boolean;
  hasMarketingUrgency: boolean;
  suggestedCategory: InboxAiCategory;
};

const BULK_SENDER =
  /instagram|facebookmail|mail\.instagram|meta\.com|linkedin|twitter|x\.com|tiktok|pinterest|snapchat|shopify|mailchimp|sendgrid|amazonses|beehiiv|substack|youtube|discord|noreply|no-reply|donotreply|notifications?@|updates@|marketing@|promo@|newsletter@|deals@|offers@|campaign@/i;

const UNSUB_NEWSLETTER =
  /unsubscribe|opt[\s-]?out|list-unsubscribe|email preferences|manage (your )?preferences|update subscription|mailing list|view in browser|view this email|read online|view online|sei iscritto|disiscriv|annulla iscrizione/i;

const DISCOUNT_OFFER =
  /\b\d{1,3}\s*%\s*off\b|\b\d+\s*%\s*discount\b|\bup to \d+%|\bsave \d+%|\b90\s*%\s*off\b|\bsconto\b|\bofferta\b|\brisparmi\b/i;

const LIMITED_TIME =
  /\blimited[\s-]time\b|\blast[\s-]chance\b|\bends?\s+(?:soon|tonight|today|midnight)\b|\bexpires?\s+(?:soon|tonight|today|midnight)\b|\boffer expires\b|\bscade\b|\bultimi giorni\b|\bsolo per oggi\b|\bonly (?:today|until)\b/i;

const MARKETING_CTA =
  /\b(act now|shop now|order now|buy now|claim (?:your|now)|grab (?:your|this)|get (?:your|it) now|don't miss|do not miss|hurry|while supplies last|exclusive (?:deal|offer|access)|vip access|bonus inside|free gift|click here|scopri (?:subito|ora)|acquista ora|ordina ora|iscriviti ora)\b/i;

const PROMO_URGENCY =
  /\b(urgent[!.:]?\s*(?:offer|deal|sale|discount|news)|flash sale|mega sale|biggest sale|clearance|black friday|cyber monday|price drop|lowest price)\b/i;

const FAKE_URGENCY_SUBJECT =
  /^[^?]*\b(urgent|urgente|act now|limited time|last chance|expires)\b[^?]*!+$/i;

const SPAMMY_SUBJECT =
  /!{2,}|\b(free|win|winner|congratulations|claim your)\b.*!|🔥|⚡|💰|🎁|🚨|‼️/;

const IT_MARKETING =
  /\b(promozione|promo|offerta esclusiva|sconto esclusivo|non perdere|ultima occasione|affrettati|iscrizione gratuita)\b/i;

/** Questions that are marketing hooks, not human asks. */
const MARKETING_QUESTION =
  /\?(?:\s|$)|\b(ready to save|want to save|want \d+% off|interested in (?:this|our) offer|why wait|still thinking)\b/i;

export function detectPromotionalSignals(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): PromotionalAnalysis {
  const hay = emailHaystack(row);
  const raw = emailText(row);
  const sender = row.sender.toLowerCase();
  const subject = row.subject ?? "";
  const hits: PromotionalSignalHit[] = [];

  const add = (code: string, label: string, weight: number) => {
    hits.push({ code, label, weight });
  };

  if (BULK_SENDER.test(sender)) {
    add("bulk_sender", "Bulk/marketing sender address", 28);
  }
  if (UNSUB_NEWSLETTER.test(hay)) {
    add("unsubscribe", "Unsubscribe or list-mail footer", 32);
  }
  if (DISCOUNT_OFFER.test(hay)) {
    add("discount", "Discount or percent-off offer", 26);
  }
  if (LIMITED_TIME.test(hay)) {
    add("limited_time", "Limited-time / expiring offer", 24);
  }
  if (MARKETING_CTA.test(hay)) {
    add("marketing_cta", "Promotional call-to-action", 22);
  }
  if (PROMO_URGENCY.test(hay)) {
    add("marketing_urgency", "Marketing-style urgency (not human)", 26);
  }
  if (IT_MARKETING.test(hay)) {
    add("italian_marketing", "Italian promotional phrasing", 20);
  }
  if (FAKE_URGENCY_SUBJECT.test(subject) || /^urgent[!:\s-]+/i.test(subject.trim())) {
    add("fake_urgency_subject", "Subject-line fake urgency", 22);
  }
  if (SPAMMY_SUBJECT.test(subject) || SPAMMY_SUBJECT.test(raw.slice(0, 200))) {
    add("spammy_formatting", "Excessive caps, emojis, or hype formatting", 18);
  }
  if (/\b(sponsored|advertisement|paid partnership|affiliate link)\b/i.test(hay)) {
    add("sponsored", "Sponsored or ad disclosure", 20);
  }
  if (/\b(weekly digest|daily digest|newsletter|your weekly|this week in)\b/i.test(hay)) {
    add("newsletter_digest", "Newsletter or digest framing", 24);
  }

  const score = Math.min(100, hits.reduce((s, h) => s + h.weight, 0));
  const isNewsletterStyle =
    hits.some((h) => ["unsubscribe", "newsletter_digest"].includes(h.code)) &&
    !hits.some((h) => h.code === "discount" || h.code === "marketing_cta");
  const hasMarketingUrgency = hits.some((h) =>
    ["marketing_urgency", "fake_urgency_subject", "limited_time"].includes(h.code),
  );
  const isBulkMarketing = score >= 40 || (BULK_SENDER.test(sender) && score >= 22);

  let suggestedCategory: InboxAiCategory = "promotion";
  if (isNewsletterStyle && score >= 30) {
    suggestedCategory = "newsletter";
  } else if (score >= 50 && !isNewsletterStyle) {
    suggestedCategory = "promotion";
  } else if (score >= 28) {
    suggestedCategory = isNewsletterStyle ? "newsletter" : "promotion";
  }

  return {
    score,
    hits,
    isBulkMarketing,
    isNewsletterStyle,
    hasMarketingUrgency,
    suggestedCategory,
  };
}

/** Marketing emails often end with rhetorical questions — not human requests. */
export function isMarketingStyleQuestion(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  promo?: PromotionalAnalysis,
): boolean {
  const hay = emailHaystack(row);
  const hasQ = /\?/.test(hay);
  if (!hasQ) return false;

  const p = promo ?? detectPromotionalSignals(row);
  if (p.score < 18) return false;

  if (MARKETING_QUESTION.test(hay) && p.score >= 22) return true;
  if (p.isBulkMarketing && hasQ && !/\b(can you|could you|would you|please confirm|pickup|riunione|appuntamento)\b/i.test(hay)) {
    return true;
  }
  return false;
}

export function isPromotionalDominant(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  realHumanScore: number,
): boolean {
  const promo = detectPromotionalSignals(row);
  if (promo.score >= 45 && realHumanScore < 30) return true;
  if (promo.score >= 35 && realHumanScore < 18) return true;
  if (promo.isBulkMarketing && promo.score >= 28 && realHumanScore < 35) return true;
  return promo.score >= realHumanScore + 20 && promo.score >= 32;
}
