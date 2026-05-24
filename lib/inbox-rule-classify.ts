import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  analyzeEmailIntent,
  hasHighPriorityIntent,
  isInboundBusinessInquiry,
} from "@/lib/email-intent";
import {
  emailHaystack,
  hasUrgentHumanSignal,
  isCommercialBulk,
  isTransactionalFyi,
} from "@/lib/inbox-triage-signals";
import { mustNotAutoHandle } from "@/lib/categorization-intelligence";

/** Score to hard-lock and skip AI. */
export const RULE_LOCK_SCORE = 2;

/** Score to assign via rules without AI (soft lock). */
export const RULE_SOFT_SCORE = 1;

/** Minimum commercial signal to nudge AI away from needs_attention. */
export const RULE_LEAN_SCORE = 1.5;

export type InboxRuleScores = {
  promotion: number;
  newsletter: number;
  handled: number;
  reasons: string[];
};

const KNOWN_BULK_PLATFORM =
  /instagram|mail\.instagram|facebookmail|fb\.com|meta\.com|linkedin|mail\.linkedin|twitter|x\.com|shopify|mailchimp|sendgrid|amazonses|customer\.io|beehiiv|substack|google\s*alerts|youtube|tiktok|pinterest|snapchat|discord|slack-mail|intercom|hubspot|salesforce|braze|postmark|sparkpost|klaviyo|drip\.com|activecampaign|constant\s*contact|mailjet|sendinblue|brevo|notifications?@/i;

const BILLING_VENDOR =
  /shopify|stripe|paypal|square|aws\s*billing|google\s*pay|apple\.com|itunes|microsoft\s*billing|adobe|zoom\.us|notion\.so|vercel|netlify|github|gitlab|heroku|digitalocean|linode|cloudflare/i;

export function isBillingLikely(row: GmailInboxRow): boolean {
  if (isInboundBusinessInquiry(row) || hasHighPriorityIntent(row)) {
    return false;
  }
  if (!BILLING_VENDOR.test(row.sender)) return false;
  const hay = `${row.subject} ${row.snippet ?? ""}`.toLowerCase();
  return /invoice|receipt|charged|subscription renewed|payment due|amount due|statement|plan renewal|your bill|monthly invoice/i.test(
    hay,
  );
}

function scoreSender(sender: string, out: InboxRuleScores, row: GmailInboxRow): void {
  const s = sender.toLowerCase();

  if (KNOWN_BULK_PLATFORM.test(s) && !isBillingLikely(row)) {
    out.promotion += 3.5;
    out.reasons.push("sender:known_bulk_platform");
  }

  if (BILLING_VENDOR.test(s)) {
    out.handled += 2;
    out.reasons.push("sender:billing_vendor");
  }

  if (isBillingLikely(row)) {
    out.handled += 4;
    out.reasons.push("billing_vendor_plus_copy");
  }

  if (s.includes("newsletter")) {
    out.newsletter += 4;
    out.reasons.push("sender:newsletter");
  } else if (/\bnews\b/i.test(s) && !s.includes("newsletter")) {
    out.newsletter += 1.5;
    out.reasons.push("sender:news_word");
  }

  const tokens: Array<{ needle: string; promo: number; news: number; handled?: number }> = [
    { needle: "noreply", promo: 0.5, news: 1, handled: 0.5 },
    { needle: "no-reply", promo: 0.5, news: 1, handled: 0.5 },
    { needle: "donotreply", promo: 0.5, news: 1, handled: 0.5 },
    { needle: "marketing", promo: 3.5, news: 0 },
    { needle: "deals", promo: 3, news: 0 },
    { needle: "promo", promo: 3.5, news: 0 },
    { needle: "offers", promo: 3, news: 0 },
    { needle: "notify@", promo: 2, news: 1 },
    { needle: "updates@", promo: 2, news: 1.5 },
    { needle: "digest@", promo: 1, news: 2.5 },
  ];
  for (const { needle, promo, news, handled: h } of tokens) {
    if (s.includes(needle)) {
      out.promotion += promo;
      out.newsletter += news;
      if (h) out.handled += h;
      out.reasons.push(`sender:${needle}`);
    }
  }
}

function scoreSubject(subject: string, out: InboxRuleScores): void {
  const sub = subject.toLowerCase();
  if (KNOWN_BULK_PLATFORM.test(sub)) {
    out.promotion += 3;
    out.reasons.push("subject:bulk_platform");
  }
  if (/\bnotification|\bupdate|\bactivity\b|\bmentioned you\b|\bliked your\b/i.test(sub)) {
    out.promotion += 2.5;
    out.reasons.push("subject:social_notification");
  }
  if (/\bnewsletter\b|\bdigest\b|\bweekly\b|\bdaily\b/i.test(sub)) {
    out.newsletter += 2.5;
    out.reasons.push("subject:newsletter_word");
  }
}

function scoreHaystack(hay: string, out: InboxRuleScores): void {
  const unsubLike =
    /unsubscribe|opt\s*out|opt-out|list-unsubscribe|email\s+preferences|manage\s+(your\s+)?preferences|update\s+subscription/i;
  if (unsubLike.test(hay)) {
    out.newsletter += 4;
    out.reasons.push("body:unsubscribe_or_prefs");
  }

  const patterns: Array<{ re: RegExp; promo: number; news: number; handled?: number; tag: string }> = [
    { re: /\bsponsored\b/i, promo: 3.5, news: 0, tag: "sponsored" },
    {
      re: /\bview\s+in\s+browser\b|\bread\s+online\b|\bview\s+this\s+email\b|\bopen\s+in\s+browser\b/i,
      promo: 0,
      news: 2.5,
      tag: "view_online",
    },
    {
      re: /\bsale\b|\bdiscount\b|\b\d{1,2}%\s*off\b|\b\d+%\s+discount\b|\b10%\s+off\b|\blimited\s+time\b|\blast\s+chance\b|\bact\s+now\b|\bexclusive\s+offer\b|\bspecial\s+offer\b/i,
      promo: 4,
      news: 0,
      tag: "sale_discount",
    },
    {
      re: /\$\d+k\/yr|\bbook\s+sales\b|\bpassive\s+income\b|\bmake\s+money\b|\bcreator\s+economy\b|\baffiliate\b|\bwaitlist\b|\bfunnel\b|\bwebinar\b|\bmasterclass\b|\benroll\s+now\b|\bjoin\s+the\s+waitlist\b/i,
      promo: 4.5,
      news: 0.5,
      tag: "creator_funnel",
    },
    {
      re: /\bfree\s+shipping\b|\bpromo\s+code\b|\bshop\s+now\b|\border\s+now\b|\badd\s+to\s+cart\b/i,
      promo: 2.5,
      news: 0,
      tag: "commerce_cta",
    },
    {
      re: /\border\s+confirmed\b|\bpayment\s+received\b|\breceipt\b|\btracking\s+number\b|\bshipment\b|\bhas\s+shipped\b|\binvoice\b|\bcharged\b|\bsubscription\s+renewed\b|\bamount\s+due\b|\bpayment\s+due\b|\bmonthly\s+invoice\b/i,
      promo: 0,
      news: 0,
      handled: 4,
      tag: "transactional",
    },
    {
      re: /\bnew\s+notifications?\b|\byou\s+have\s+\d+\s+new\b|\bfollow\s+requests?\b|\bmentioned you\b|\bliked your\b|\bcommented on\b/i,
      promo: 2.5,
      news: 0.5,
      tag: "social_notification",
    },
  ];
  for (const { re, promo, news, handled: h, tag } of patterns) {
    if (re.test(hay)) {
      out.promotion += promo;
      out.newsletter += news;
      if (h) out.handled += h;
      out.reasons.push(`body:${tag}`);
    }
  }
}

export function computeInboxRuleScores(row: GmailInboxRow): InboxRuleScores {
  const out: InboxRuleScores = { promotion: 0, newsletter: 0, handled: 0, reasons: [] };
  scoreSender(row.sender, out, row);
  scoreSubject(row.subject ?? "", out);
  scoreHaystack(`${row.subject} ${row.snippet ?? ""}`, out);
  return out;
}

function scoreToConfidence(maxScore: number): number {
  return Math.min(0.97, 0.58 + 0.1 * Math.min(maxScore, 4));
}

function pickWinnerFromScores(
  scores: InboxRuleScores,
  row: GmailInboxRow,
): InboxAiCategory | null {
  const { promotion, newsletter, handled } = scores;
  const max = Math.max(promotion, newsletter, handled);
  if (max < RULE_SOFT_SCORE) return null;

  if (handled >= max && handled >= promotion && handled >= newsletter) {
    return "handled";
  }
  if (promotion >= max && promotion > newsletter) {
    return "promotion";
  }
  if (newsletter >= max && newsletter > promotion) {
    return "newsletter";
  }
  if (promotion >= RULE_SOFT_SCORE && newsletter >= RULE_SOFT_SCORE) {
    const hay = `${row.subject} ${row.snippet ?? ""}`.toLowerCase();
    const commerceHeavy =
      /\bsale\b|\bdiscount\b|\b\d{1,2}%\s*off\b|\blimited\s+time\b|\bfree\s+shipping\b|\bpromo\s+code\b|\bshop\s+now\b/i.test(
        hay,
      );
    return commerceHeavy ? "promotion" : "newsletter";
  }
  if (promotion >= RULE_SOFT_SCORE) return "promotion";
  if (newsletter >= RULE_SOFT_SCORE) return "newsletter";
  if (handled >= RULE_SOFT_SCORE) return "handled";
  return null;
}

export type RuleClassifyResult = {
  category: InboxAiCategory;
  confidence: number;
  scores: InboxRuleScores;
  matchType: "hard" | "soft";
};

/**
 * Deterministic classification (priority 1). Returns null only when no rule signal
 * and the message may need AI / human triage.
 */
export function ruleClassify(row: GmailInboxRow): RuleClassifyResult | null {
  const intent = analyzeEmailIntent(row);
  if (intent.highPriority) {
    return {
      category: intent.suggestedCategory,
      confidence: Math.max(0.88, intent.confidence),
      scores: computeInboxRuleScores(row),
      matchType: "hard",
    };
  }

  const scores = computeInboxRuleScores(row);

  if (isTransactionalFyi(row) && !hasUrgentHumanSignal(row) && !mustNotAutoHandle(row)) {
    return { category: "handled", confidence: 0.9, scores, matchType: "hard" };
  }

  if (isCommercialBulk(row) && !hasUrgentHumanSignal(row)) {
    const cat =
      scores.newsletter > scores.promotion && scores.newsletter >= RULE_SOFT_SCORE
        ? "newsletter"
        : "promotion";
    return {
      category: cat,
      confidence: scoreToConfidence(Math.max(scores.promotion, scores.newsletter)),
      scores,
      matchType: "hard",
    };
  }

  if (isBillingLikely(row) && !mustNotAutoHandle(row)) {
    return { category: "handled", confidence: 0.93, scores, matchType: "hard" };
  }

  const { promotion, newsletter, handled } = scores;

  if (handled >= RULE_LOCK_SCORE && handled >= promotion && handled >= newsletter && !mustNotAutoHandle(row)) {
    return {
      category: "handled",
      confidence: scoreToConfidence(handled),
      scores,
      matchType: "hard",
    };
  }

  if (promotion >= RULE_LOCK_SCORE && promotion > newsletter) {
    return {
      category: "promotion",
      confidence: scoreToConfidence(promotion),
      scores,
      matchType: "hard",
    };
  }

  if (newsletter >= RULE_LOCK_SCORE && newsletter > promotion) {
    return {
      category: "newsletter",
      confidence: scoreToConfidence(newsletter),
      scores,
      matchType: "hard",
    };
  }

  if (promotion >= RULE_LOCK_SCORE && newsletter >= RULE_LOCK_SCORE) {
    const hay = `${row.subject} ${row.snippet ?? ""}`.toLowerCase();
    const commerceHeavy =
      /\bsale\b|\bdiscount\b|\b\d{1,2}%\s*off\b|\blimited\s+time\b|\bfree\s+shipping\b|\bpromo\s+code\b|\bshop\s+now\b/i.test(
        hay,
      );
    const cat: InboxAiCategory = commerceHeavy ? "promotion" : "newsletter";
    return {
      category: cat,
      confidence: scoreToConfidence(Math.max(promotion, newsletter)) * 0.92,
      scores,
      matchType: "hard",
    };
  }

  const soft = pickWinnerFromScores(scores, row);
  if (soft) {
    const max = Math.max(promotion, newsletter, handled);
    return {
      category: soft,
      confidence: scoreToConfidence(max) * 0.85,
      scores,
      matchType: "soft",
    };
  }

  return null;
}

/** @deprecated Use ruleClassify */
export function rulePrecClassify(row: GmailInboxRow): {
  category: InboxAiCategory | null;
  confidence: number;
  scores: InboxRuleScores;
} {
  const r = ruleClassify(row);
  if (!r) return { category: null, confidence: 0, scores: computeInboxRuleScores(row) };
  return { category: r.category, confidence: r.confidence, scores: r.scores };
}

export function commercialLeanCategory(row: GmailInboxRow): InboxAiCategory | null {
  const scores = computeInboxRuleScores(row);
  const maxCommercial = Math.max(scores.promotion, scores.newsletter);
  if (maxCommercial < RULE_LEAN_SCORE) return null;
  return pickWinnerFromScores(
    { ...scores, handled: Math.min(scores.handled, maxCommercial - 0.1) },
    row,
  );
}

export function hardPostAiCategory(row: GmailInboxRow): InboxAiCategory | null {
  if (hasHighPriorityIntent(row)) {
    return analyzeEmailIntent(row).suggestedCategory;
  }
  if (mustNotAutoHandle(row)) {
    return analyzeEmailIntent(row).suggestedCategory;
  }
  if (isTransactionalFyi(row) && !hasUrgentHumanSignal(row)) return "handled";
  if (isCommercialBulk(row) && !hasUrgentHumanSignal(row)) {
    const scores = computeInboxRuleScores(row);
    return scores.newsletter > scores.promotion ? "newsletter" : "promotion";
  }
  if (isBillingLikely(row) && !mustNotAutoHandle(row)) return "handled";

  const scores = computeInboxRuleScores(row);
  const hay = emailHaystack(row);

  if (BILLING_VENDOR.test(row.sender) && /invoice|receipt|billing|charged|payment|subscription|renewed|amount due|summary/i.test(hay)) {
    return "handled";
  }

  if (KNOWN_BULK_PLATFORM.test(row.sender.toLowerCase()) && !isBillingLikely(row)) {
    return "promotion";
  }

  return pickWinnerFromScores(scores, row);
}

/** True when copy/sender suggests a real person expecting a substantive reply. */
export function looksLikeHumanConversation(row: GmailInboxRow): boolean {
  return hasUrgentHumanSignal(row);
}

/** Demote misfiled needs_attention when no real urgency. */
export function coerceNeedsAttentionCategory(
  row: GmailInboxRow,
  category: InboxAiCategory,
): InboxAiCategory {
  if (hasHighPriorityIntent(row)) {
    const intent = analyzeEmailIntent(row);
    if (
      category === "handled" ||
      category === "promotion" ||
      category === "newsletter"
    ) {
      return intent.suggestedCategory;
    }
    if (intent.kinds.includes("pricing_inquiry") || intent.kinds.includes("sales_lead")) {
      return "needs_attention";
    }
  }

  if (category !== "needs_attention" && category !== "quick_reply") {
    return category;
  }
  if (mustNotAutoHandle(row)) {
    return analyzeEmailIntent(row).suggestedCategory;
  }
  if (hasUrgentHumanSignal(row)) {
    return category;
  }
  const scores = computeInboxRuleScores(row);
  if (Math.max(scores.promotion, scores.newsletter) >= 0.5) {
    const lean = commercialLeanCategory(row);
    if (lean) return lean;
  }
  const hard = hardPostAiCategory(row);
  if (hard) return hard;
  const lean = commercialLeanCategory(row);
  if (lean) return lean;
  if (isCommercialBulk(row)) return "promotion";
  if (mustNotAutoHandle(row)) return "needs_attention";
  return "handled";
}
