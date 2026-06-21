/**
 * Single source of truth for inbox AI categories.
 *
 * Canonical slugs ONLY — legacy values are coerced via coerceLegacyInboxCategory().
 */

/** Protected system categories — cannot be deleted by users. */
export const SYSTEM_INBOX_CATEGORY_VALUES = [
  "worth_your_attention",
  "good_to_know",
  "promotions",
  "newsletters",
] as const;

/** Hard UI render order — tabs, sections, selectors. */
export const CANONICAL_CATEGORY_ORDER: readonly SystemInboxCategory[] =
  SYSTEM_INBOX_CATEGORY_VALUES;

/** @deprecated Use SYSTEM_INBOX_CATEGORY_VALUES */
export const INBOX_AI_CATEGORY_VALUES = SYSTEM_INBOX_CATEGORY_VALUES;

export type SystemInboxCategory = (typeof SYSTEM_INBOX_CATEGORY_VALUES)[number];

/** System slug or user personal id (custom:your_label). */
export type InboxAiCategory = SystemInboxCategory | string;

export type InboxCategoryLocale = "en" | "it";

/** Legacy / drift slugs → canonical slug. */
const LEGACY_CATEGORY_MAP: Record<string, SystemInboxCategory> = {
  needs_attention: "worth_your_attention",
  need_attention: "worth_your_attention",
  needsattention: "worth_your_attention",
  attention: "worth_your_attention",
  worthyourattention: "worth_your_attention",
  quick_reply: "worth_your_attention",
  quickreply: "worth_your_attention",
  quick_wins: "worth_your_attention",
  focus: "worth_your_attention",
  fyi: "good_to_know",
  goodtoknow: "good_to_know",
  handled: "good_to_know",
  can_wait: "good_to_know",
  passive: "good_to_know",
  background: "good_to_know",
  no_action: "good_to_know",
  informational: "good_to_know",
  promotion: "promotions",
  promotional: "promotions",
  marketing: "promotions",
  newsletter: "newsletters",
  digest: "newsletters",
  waiting: "worth_your_attention",
  waiting_on: "worth_your_attention",
  waiting_on_reply: "worth_your_attention",
  waiting_for_response: "worth_your_attention",
  complete: "good_to_know",
  completed: "good_to_know",
  done: "good_to_know",
  archived: "good_to_know",
};

type InboxCategoryMeta = {
  selectorOrder: number;
  tabOrder: number;
  summaryOrder: number;
  sectionOrder: number;
  title: Record<InboxCategoryLocale, string>;
  selectorLabel?: Partial<Record<InboxCategoryLocale, string>>;
  subtitle?: Partial<Record<InboxCategoryLocale, string>>;
  emptyMessage?: Partial<Record<InboxCategoryLocale, string>>;
  clearSeconds: number;
  learnPriority: number;
  isClutter?: boolean;
  tabGuidance?: Partial<Record<InboxCategoryLocale, string>>;
  cardAccentClass: string;
};

const INBOX_CATEGORY_META: Record<SystemInboxCategory, InboxCategoryMeta> = {
  worth_your_attention: {
    selectorOrder: 0,
    tabOrder: 0,
    summaryOrder: 0,
    sectionOrder: 0,
    title: { en: "Worth your attention", it: "Da vedere" },
    subtitle: {
      en: "Emails requiring action, response, or decision.",
      it: "Email che richiedono azione, risposta o decisione.",
    },
    emptyMessage: {
      en: "Nothing important appears to need your attention right now.",
      it: "Per ora niente di importante sembra aver bisogno di te.",
    },
    clearSeconds: 90,
    learnPriority: 5,
    cardAccentClass: "border-l-4 border-l-accent bg-accent-muted/25",
  },
  good_to_know: {
    selectorOrder: 1,
    tabOrder: 1,
    summaryOrder: 1,
    sectionOrder: 1,
    title: { en: "Good to know", it: "Da sapere" },
    selectorLabel: {
      en: "Good to know (no action needed)",
      it: "Da sapere (nessuna azione necessaria)",
    },
    subtitle: {
      en: "Informational emails — no action required.",
      it: "Email informative — nessuna azione necessaria.",
    },
    emptyMessage: {
      en: "No new updates to be aware of right now.",
      it: "Nessun nuovo aggiornamento da sapere per ora.",
    },
    clearSeconds: 10,
    learnPriority: 3,
    cardAccentClass: "border-l-4 border-l-sky-500 bg-sky-50/30",
  },
  promotions: {
    selectorOrder: 2,
    tabOrder: 2,
    summaryOrder: 2,
    sectionOrder: 2,
    title: { en: "Promotions", it: "Promozioni" },
    subtitle: {
      en: "Marketing, ads, and sales content.",
      it: "Marketing, pubblicità e offerte.",
    },
    tabGuidance: {
      en: "Promotions are hidden from your main workflow, but you can always review them here.",
      it: "Le promozioni sono fuori dal flusso principale, ma puoi sempre rivederle qui.",
    },
    emptyMessage: {
      en: "No promotional emails are waiting.",
      it: "Nessuna email promozionale in attesa.",
    },
    clearSeconds: 3,
    learnPriority: 0,
    isClutter: true,
    cardAccentClass: "border-l-4 border-l-amber-500 bg-amber-50/35",
  },
  newsletters: {
    selectorOrder: 3,
    tabOrder: 3,
    summaryOrder: 3,
    sectionOrder: 3,
    title: { en: "Newsletters", it: "Newsletter" },
    subtitle: {
      en: "Recurring or subscription-based content.",
      it: "Contenuti ricorrenti o in abbonamento.",
    },
    tabGuidance: {
      en: "Newsletters are grouped out of your main workflow, but you can always review them here.",
      it: "Le newsletter sono fuori dal flusso principale, ma puoi sempre rivederle qui.",
    },
    emptyMessage: {
      en: "No newsletters are waiting.",
      it: "Nessuna newsletter in attesa.",
    },
    clearSeconds: 6,
    learnPriority: 1,
    isClutter: true,
    cardAccentClass: "border-l-4 border-l-slate-400 bg-slate-50/50",
  },
};

function sortByMeta<K extends keyof InboxCategoryMeta>(
  key: K,
  filter?: (meta: InboxCategoryMeta) => boolean,
): SystemInboxCategory[] {
  return [...CANONICAL_CATEGORY_ORDER]
    .filter((id) => (filter ? filter(INBOX_CATEGORY_META[id]) : true))
    .sort((a, b) => {
      const av = INBOX_CATEGORY_META[a][key];
      const bv = INBOX_CATEGORY_META[b][key];
      return typeof av === "number" && typeof bv === "number" ? av - bv : 0;
    });
}

export const INBOX_CATEGORY_SELECTOR_ORDER: InboxAiCategory[] = sortByMeta("selectorOrder");
export const CATEGORY_OPTIONS = INBOX_CATEGORY_SELECTOR_ORDER;
export const INBOX_CATEGORY_TAB_ORDER: InboxAiCategory[] = sortByMeta("tabOrder");
export const INBOX_CATEGORY_SUMMARY_ORDER: InboxAiCategory[] = sortByMeta("summaryOrder");
export const GMAIL_INBOX_SECTION_ORDER: InboxAiCategory[] = sortByMeta("sectionOrder");
export const INBOX_CATEGORY_PRIMARY_ORDER: InboxAiCategory[] = sortByMeta(
  "sectionOrder",
  (m) => !m.isClutter,
);
export const INBOX_CLUTTER_CATEGORIES: InboxAiCategory[] = sortByMeta(
  "sectionOrder",
  (m) => Boolean(m.isClutter),
);

export const AI_INBOX_CATEGORY_VALUES: readonly SystemInboxCategory[] =
  SYSTEM_INBOX_CATEGORY_VALUES;

export type CategorySource =
  | "rule"
  | "ai"
  | "heuristic"
  | "ai_coerced"
  | "user_rule"
  | "sender_rule"
  | "memory_rule"
  | "manual_override"
  | "relationship_rule"
  | "semantic_rule"
  | "multilingual_rule"
  | "intelligence_rule";

export function isSystemInboxCategory(value: string): value is SystemInboxCategory {
  return (SYSTEM_INBOX_CATEGORY_VALUES as readonly string[]).includes(value);
}

/** @deprecated Use isSystemInboxCategory */
export function isInboxAiCategory(value: string): value is SystemInboxCategory {
  return isSystemInboxCategory(value);
}

function normalizeCategoryKey(raw: string): string {
  return raw.replace(/[\s-]+/g, "_").toLowerCase().replace(/[^a-z0-9_:]/g, "");
}

/** Map any stored / AI / legacy slug to a canonical system category. */
export function coerceLegacyInboxCategory(category: string): InboxAiCategory {
  const s = String(category ?? "").trim();
  if (!s) return "good_to_know";
  if (isSystemInboxCategory(s)) return s;
  const normalized = normalizeCategoryKey(s);
  if (isSystemInboxCategory(normalized)) return normalized;
  const mapped = LEGACY_CATEGORY_MAP[normalized];
  if (mapped) return mapped;
  return s;
}

export function inboxCategoryMeta(category: SystemInboxCategory): InboxCategoryMeta {
  return INBOX_CATEGORY_META[category];
}

export function inboxCategorySectionTitle(
  category: string,
  locale: InboxCategoryLocale,
): string {
  const coerced = coerceLegacyInboxCategory(category);
  if (isSystemInboxCategory(coerced)) return INBOX_CATEGORY_META[coerced].title[locale];
  return category;
}

export function inboxCategorySelectorLabel(
  category: string,
  locale: InboxCategoryLocale,
): string {
  const coerced = coerceLegacyInboxCategory(category);
  if (!isSystemInboxCategory(coerced)) return category;
  const meta = INBOX_CATEGORY_META[coerced];
  return meta.selectorLabel?.[locale] ?? meta.title[locale];
}

export function inboxCategorySectionSubtitle(
  category: string,
  locale: InboxCategoryLocale,
): string | undefined {
  const coerced = coerceLegacyInboxCategory(category);
  if (!isSystemInboxCategory(coerced)) return undefined;
  return INBOX_CATEGORY_META[coerced].subtitle?.[locale];
}

export function inboxCategoryEmptyMessage(
  category: string,
  locale: InboxCategoryLocale,
): string | undefined {
  const coerced = coerceLegacyInboxCategory(category);
  if (!isSystemInboxCategory(coerced)) return undefined;
  return INBOX_CATEGORY_META[coerced].emptyMessage?.[locale];
}

export function inboxCategoryTabGuidance(
  category: string,
  locale: InboxCategoryLocale,
): string | undefined {
  const coerced = coerceLegacyInboxCategory(category);
  if (!isSystemInboxCategory(coerced)) return undefined;
  return INBOX_CATEGORY_META[coerced].tabGuidance?.[locale];
}

export function inboxCategoryClearSeconds(category: string): number {
  const coerced = coerceLegacyInboxCategory(category);
  if (!isSystemInboxCategory(coerced)) return 12;
  return INBOX_CATEGORY_META[coerced].clearSeconds;
}

export function inboxCategoryLearnPriority(category: string): number {
  const coerced = coerceLegacyInboxCategory(category);
  if (!isSystemInboxCategory(coerced)) return 2;
  return INBOX_CATEGORY_META[coerced].learnPriority;
}

export function inboxCategoryCardAccent(category: string): string {
  const coerced = coerceLegacyInboxCategory(category);
  if (!isSystemInboxCategory(coerced)) {
    return "border-l-4 border-l-violet-400 bg-violet-50/25";
  }
  return INBOX_CATEGORY_META[coerced].cardAccentClass;
}

export function inboxCategorySqlCheckConstraint(): string {
  const values = SYSTEM_INBOX_CATEGORY_VALUES.map((v) => `'${v}'`).join(",\n      ");
  return `category is null or category in (\n      ${values}\n    ) or category like 'custom:%'`;
}

function synonymToCategory(t: string): SystemInboxCategory | null {
  const legacy = LEGACY_CATEGORY_MAP[t];
  if (legacy) return legacy;

  if (
    t === "advertisement" ||
    t === "advertising" ||
    t === "ads" ||
    t === "sale" ||
    t === "spam" ||
    t === "deal"
  ) {
    return "promotions";
  }
  if (t === "subscription" || t === "substack" || t === "blog") {
    return "newsletters";
  }
  if (
    t === "info" ||
    t === "notification" ||
    t === "notifications" ||
    t === "alert" ||
    t === "update" ||
    t === "confirmation" ||
    t === "shipping" ||
    t === "delivery" ||
    t === "receipt"
  ) {
    return "good_to_know";
  }
  if (t === "action_required" || t === "actionrequired" || t === "important" || t === "urgent" || t === "todo") {
    return "worth_your_attention";
  }
  return null;
}

/** Parse model output — returns null if not a known canonical (or personal) category. */
export function parseInboxAiCategory(
  raw: string,
  personalIds?: readonly string[],
): InboxAiCategory | null {
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const t = normalizeCategoryKey(s);
  if (isSystemInboxCategory(t)) return t;
  if (personalIds?.includes(t)) return t;
  if (personalIds?.includes(`custom:${t}`)) return `custom:${t}`;
  if (t.startsWith("custom_")) {
    const id = `custom:${t.slice(7)}`;
    if (personalIds?.includes(id)) return id;
  }
  const synonym = synonymToCategory(t);
  if (synonym) return synonym;
  return null;
}

export function normalizeInboxAiCategory(
  raw: string,
  personalIds?: readonly string[],
): InboxAiCategory {
  return parseInboxAiCategory(raw, personalIds) ?? "good_to_know";
}

/** Reject non-canonical AI output — always returns a canonical system slug. */
export function enforceCanonicalInboxCategory(raw: string): SystemInboxCategory {
  const parsed = parseInboxAiCategory(raw);
  if (parsed && isSystemInboxCategory(parsed)) return parsed;
  const coerced = coerceLegacyInboxCategory(raw);
  if (isSystemInboxCategory(coerced)) return coerced;
  return "good_to_know";
}
