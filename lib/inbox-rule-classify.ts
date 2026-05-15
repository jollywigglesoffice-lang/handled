import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

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
  /instagram|facebookmail|fb\.com|linkedin|mail\.linkedin|twitter|shopify|mailchimp|sendgrid|amazonses|customer\.io|beehiiv|substack|google\s*alerts|youtube|tiktok|pinterest|snapchat|discord|slack-mail|intercom|hubspot|salesforce|braze|postmark|sparkpost|klaviyo|drip\.com|activecampaign|constant\s*contact|mailjet|sendinblue|brevo/i;

const BILLING_VENDOR =
  /shopify|stripe|paypal|square|aws\s*billing|google\s*pay|apple\.com|itunes|microsoft\s*billing|adobe|zoom\.us|notion\.so|vercel|netlify|github|gitlab|heroku|digitalocean|linode|cloudflare/i;

export function isBillingLikely(row: GmailInboxRow): boolean {
  if (!BILLING_VENDOR.test(row.sender)) return false;
  const hay = `${row.subject} ${row.snippet ?? ""}`.toLowerCase();
  return /invoice|receipt|billing|charged|subscription|payment due|amount due|summary|statement|plan renewal|your bill|monthly invoice/i.test(
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
      re: /\bsale\b|\bdiscount\b|\b\d{1,2}%\s*off\b|\blimited\s+time\b|\blast\s+chance\b|\bact\s+now\b/i,
      promo: 3.5,
      news: 0,
      tag: "sale_discount",
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
  const scores = computeInboxRuleScores(row);

  if (isBillingLikely(row)) {
    return { category: "handled", confidence: 0.93, scores, matchType: "hard" };
  }

  const { promotion, newsletter, handled } = scores;

  if (handled >= RULE_LOCK_SCORE && handled >= promotion && handled >= newsletter) {
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
  if (isBillingLikely(row)) return "handled";

  const scores = computeInboxRuleScores(row);
  const hay = `${row.subject} ${row.snippet ?? ""} ${row.sender}`.toLowerCase();

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
  const hay = `${row.subject} ${row.snippet ?? ""}`.toLowerCase();
  const sender = row.sender.toLowerCase();

  if (KNOWN_BULK_PLATFORM.test(sender)) return false;
  if (/unsubscribe|view in browser|manage preferences|promo code|%\s*off/i.test(hay)) {
    return false;
  }
  if (BILLING_VENDOR.test(sender) && /invoice|receipt|billing|charged/i.test(hay)) {
    return false;
  }

  if (
    /\b(please confirm|could you|can you|would you|need your approval|action required|by eod|by cob|deadline|urgent|follow up|following up|let me know|waiting for your)\b/i.test(
      hay,
    )
  ) {
    return true;
  }
  if (/^re:\s/i.test(row.subject) && !/noreply|no-reply|donotreply/i.test(sender)) {
    return true;
  }
  if (
    /\b(thanks|thank you|sounds good|confirmed|received)\b/i.test(hay) &&
    hay.length < 450 &&
    !/unsubscribe/i.test(hay)
  ) {
    return true;
  }

  const personalName = /^[A-Za-z][\w.-]*\s+[A-Za-z]/.test(row.sender.trim());
  const hasQuestion = /\?/.test(hay);
  if (personalName && hasQuestion && !/@(mail|newsletter|marketing|notify)/i.test(sender)) {
    return true;
  }

  return false;
}
