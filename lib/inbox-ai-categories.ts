export const INBOX_AI_CATEGORY_VALUES = [
  "needs_attention",
  "quick_reply",
  "newsletter",
  "promotion",
  "handled",
] as const;

export type InboxAiCategory = (typeof INBOX_AI_CATEGORY_VALUES)[number];

/** How inbox `category` was assigned (API / server). */
export type CategorySource =
  | "rule"
  | "ai"
  | "heuristic"
  | "ai_coerced"
  | "user_rule"
  | "sender_rule"
  | "manual_override"
  | "relationship_rule"
  | "semantic_rule"
  | "multilingual_rule"
  | "intelligence_rule";

/** Section order in the Gmail inbox (most actionable first). */
export const GMAIL_INBOX_SECTION_ORDER: InboxAiCategory[] = [
  "needs_attention",
  "quick_reply",
  "handled",
  "newsletter",
  "promotion",
];

export function isInboxAiCategory(value: string): value is InboxAiCategory {
  return (INBOX_AI_CATEGORY_VALUES as readonly string[]).includes(value);
}

/** Map common model drift / synonyms to our canonical slugs. */
function synonymToCategory(t: string): InboxAiCategory | null {
  if (
    t === "promotional" ||
    t === "promotions" ||
    t === "marketing" ||
    t === "advertisement" ||
    t === "advertising" ||
    t === "ads" ||
    t === "sale" ||
    t === "spam" ||
    t === "deal"
  ) {
    return "promotion";
  }
  if (
    t === "newsletters" ||
    t === "digest" ||
    t === "subscription" ||
    t === "substack" ||
    t === "blog"
  ) {
    return "newsletter";
  }
  if (
    t === "fyi" ||
    t === "informational" ||
    t === "info" ||
    t === "no_action" ||
    t === "noaction" ||
    t === "automated" ||
    t === "receipt" ||
    t === "notification" ||
    t === "done" ||
    t === "complete"
  ) {
    return "handled";
  }
  if (
    t === "action_required" ||
    t === "actionrequired" ||
    t === "important" ||
    t === "urgent" ||
    t === "todo"
  ) {
    return "needs_attention";
  }
  if (t === "simple" || t === "acknowledgment" || t === "acknowledgement" || t === "short_reply") {
    return "quick_reply";
  }
  return null;
}

/** Parse model output — never defaults to needs_attention (returns null if unknown). */
export function parseInboxAiCategory(raw: string): InboxAiCategory | null {
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const t = s.replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (isInboxAiCategory(t)) return t;
  if (t === "need_attention" || t === "needsattention") return "needs_attention";
  if (t === "quickreply") return "quick_reply";
  return synonymToCategory(t);
}

/** Legacy helper — prefer parseInboxAiCategory in the categorization pipeline. */
export function normalizeInboxAiCategory(raw: string): InboxAiCategory {
  return parseInboxAiCategory(raw) ?? "handled";
}

const TITLES_EN: Record<InboxAiCategory, string> = {
  needs_attention: "Worth your attention",
  quick_reply: "Quick replies",
  handled: "Can wait",
  newsletter: "Newsletters",
  promotion: "Promotions",
};

const TITLES_IT: Record<InboxAiCategory, string> = {
  needs_attention: "Da vedere",
  quick_reply: "Risposte veloci",
  handled: "Possono aspettare",
  newsletter: "Newsletter",
  promotion: "Promozioni",
};

const SUB_EN: Partial<Record<InboxAiCategory, string>> = {
  needs_attention: "Worth checking when you have a moment.",
  quick_reply: "Short replies — no heavy lifting.",
  handled: "Informational or already quiet — safe to skim later.",
  newsletter: "Digests and recurring reads — can likely wait.",
  promotion: "Offers and marketing — can likely wait.",
};

const SUB_IT: Partial<Record<InboxAiCategory, string>> = {
  needs_attention: "Da controllare quando hai un momento.",
  quick_reply: "Risposte brevi — niente di pesante.",
  handled: "Informativi o già tranquilli — puoi leggerli dopo.",
  newsletter: "Digest e letture ricorrenti — possono aspettare.",
  promotion: "Offerte e marketing — possono aspettare.",
};

export function inboxCategorySectionTitle(
  category: InboxAiCategory,
  locale: "en" | "it",
): string {
  return locale === "it" ? TITLES_IT[category] : TITLES_EN[category];
}

export function inboxCategorySectionSubtitle(
  category: InboxAiCategory,
  locale: "en" | "it",
): string | undefined {
  return locale === "it" ? SUB_IT[category] : SUB_EN[category];
}
