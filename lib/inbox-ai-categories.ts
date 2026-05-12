export const INBOX_AI_CATEGORY_VALUES = [
  "needs_attention",
  "quick_reply",
  "newsletter",
  "promotion",
  "handled",
] as const;

export type InboxAiCategory = (typeof INBOX_AI_CATEGORY_VALUES)[number];

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

export function normalizeInboxAiCategory(raw: string): InboxAiCategory {
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isInboxAiCategory(t)) return t;
  if (t === "need_attention" || t === "needsattention") return "needs_attention";
  if (t === "quickreply") return "quick_reply";
  return "needs_attention";
}

const TITLES_EN: Record<InboxAiCategory, string> = {
  needs_attention: "Needs your attention",
  quick_reply: "Quick reply",
  handled: "Handled",
  newsletter: "Newsletters",
  promotion: "Promotions",
};

const TITLES_IT: Record<InboxAiCategory, string> = {
  needs_attention: "Richiede attenzione",
  quick_reply: "Risposta veloce",
  handled: "Gestite",
  newsletter: "Newsletter",
  promotion: "Promozioni",
};

const SUB_EN: Partial<Record<InboxAiCategory, string>> = {
  needs_attention: "Messages that likely need a decision or deeper review.",
  quick_reply: "Short acknowledgments or simple replies usually suffice.",
  handled: "Looks informational or already taken care of.",
  newsletter: "Digests, blogs, and recurring content.",
  promotion: "Marketing, offers, and sales outreach.",
};

const SUB_IT: Partial<Record<InboxAiCategory, string>> = {
  needs_attention: "Messaggi che probabilmente richiedono una decisione o più attenzione.",
  quick_reply: "Bastano conferme brevi o risposte semplici.",
  handled: "Sembrano informativi o già risolti.",
  newsletter: "Digest, blog e contenuti ricorrenti.",
  promotion: "Marketing, offerte e promozioni.",
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
