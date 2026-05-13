import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Minimum score to lock a row with rules (skip AI). */
export const RULE_LOCK_SCORE = 3;

/** Minimum score to bias AI post-processing (commercial lean). */
export const RULE_LEAN_SCORE = 2;

export type InboxRuleScores = {
  promotion: number;
  newsletter: number;
  handled: number;
  reasons: string[];
};

function scoreSender(sender: string, out: InboxRuleScores): void {
  const s = sender.toLowerCase();
  if (s.includes("newsletter")) {
    out.newsletter += 4;
    out.reasons.push("sender:newsletter");
  } else if (s.includes("news")) {
    out.newsletter += 2;
    out.reasons.push("sender:news");
  }

  const tokens: Array<{ needle: string; promo: number; news: number; handled?: number }> = [
    { needle: "noreply", promo: 0.5, news: 1, handled: 0.5 },
    { needle: "no-reply", promo: 0.5, news: 1, handled: 0.5 },
    { needle: "donotreply", promo: 0.5, news: 1, handled: 0.5 },
    { needle: "marketing", promo: 3.5, news: 0 },
    { needle: "deals", promo: 3, news: 0 },
    { needle: "promo", promo: 3.5, news: 0 },
    { needle: "offers", promo: 3, news: 0 },
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
  const patterns: Array<{ re: RegExp; promo: number; news: number; handled?: number; tag: string }> = [
    { re: /\bunsubscribe\b/i, promo: 0, news: 4, tag: "unsubscribe" },
    { re: /\bmanage\s+preferences\b/i, promo: 0, news: 3.5, tag: "manage_preferences" },
    { re: /\bsponsored\b/i, promo: 3.5, news: 0, tag: "sponsored" },
    { re: /\bview\s+in\s+browser\b|\bread\s+online\b|\bview\s+this\s+email\b/i, promo: 0, news: 2.5, tag: "view_online" },
    { re: /\bsale\b|\bdiscount\b|\b\d{1,2}%\s*off\b|\blimited\s+time\b/i, promo: 3.5, news: 0, tag: "sale_discount" },
    { re: /\bfree\s+shipping\b|\bpromo\s+code\b|\bshop\s+now\b|\border\s+now\b/i, promo: 2.5, news: 0, tag: "commerce_cta" },
    {
      re: /\border\s+confirmed\b|\bpayment\s+received\b|\breceipt\b|\btracking\s+number\b|\bshipment\b|\bhas\s+shipped\b/i,
      promo: 0,
      news: 0,
      handled: 4,
      tag: "transactional",
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
  scoreSender(row.sender, out);
  scoreHaystack(`${row.subject} ${row.snippet ?? ""}`, out);
  return out;
}

function scoreToConfidence(maxScore: number): number {
  return Math.min(0.97, 0.62 + 0.09 * Math.min(maxScore, 4));
}

/**
 * Strong rule-based label before AI. Returns null if ambiguous (send to model).
 */
export function rulePrecClassify(row: GmailInboxRow): {
  category: InboxAiCategory | null;
  confidence: number;
  scores: InboxRuleScores;
} {
  const scores = computeInboxRuleScores(row);
  const { promotion, newsletter, handled } = scores;

  if (handled >= RULE_LOCK_SCORE && handled >= promotion && handled >= newsletter) {
    return {
      category: "handled",
      confidence: scoreToConfidence(handled),
      scores,
    };
  }

  if (promotion >= RULE_LOCK_SCORE && promotion > newsletter) {
    return {
      category: "promotion",
      confidence: scoreToConfidence(promotion),
      scores,
    };
  }

  if (newsletter >= RULE_LOCK_SCORE && newsletter > promotion) {
    return {
      category: "newsletter",
      confidence: scoreToConfidence(newsletter),
      scores,
    };
  }

  if (promotion >= RULE_LOCK_SCORE && newsletter >= RULE_LOCK_SCORE) {
    const hay = `${row.subject} ${row.snippet ?? ""}`.toLowerCase();
    const commerceHeavy =
      /\bsale\b|\bdiscount\b|\b\d{1,2}%\s*off\b|\blimited\s+time\b|\bfree\s+shipping\b|\bpromo\s+code\b|\bshop\s+now\b/i.test(
        hay,
      );
    const cat: InboxAiCategory = commerceHeavy ? "promotion" : "newsletter";
    const score = Math.max(promotion, newsletter);
    return { category: cat, confidence: scoreToConfidence(score) * 0.92, scores };
  }

  return { category: null, confidence: 0, scores };
}

/** If AI said needs_attention / quick_reply but rules show commercial lean, nudge label. */
export function commercialLeanCategory(row: GmailInboxRow): InboxAiCategory | null {
  const scores = computeInboxRuleScores(row);
  const maxCommercial = Math.max(scores.promotion, scores.newsletter);
  if (maxCommercial < RULE_LEAN_SCORE) return null;

  if (scores.promotion > scores.newsletter) return "promotion";
  if (scores.newsletter > scores.promotion) return "newsletter";

  const hay = `${row.subject} ${row.snippet ?? ""}`.toLowerCase();
  if (
    /\bsale\b|\bdiscount\b|\b\d{1,2}%\s*off\b|\blimited\s+time\b|\bsponsored\b|\bpromo\b|\bdeals\b/i.test(
      hay,
    )
  ) {
    return "promotion";
  }
  return "newsletter";
}
