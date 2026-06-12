/**
 * Single source of truth for inbox AI categories.
 *
 * When adding a category:
 * 1. Add its slug to INBOX_AI_CATEGORY_VALUES and INBOX_CATEGORY_META below.
 * 2. Run supabase/sql migration to extend inbox_rules.category CHECK (see
 *    inboxCategorySqlCheckConstraint()).
 * 3. TypeScript will flag any incomplete Record<InboxAiCategory, …> maps.
 */

/** Protected system categories — cannot be deleted by users. */
export const SYSTEM_INBOX_CATEGORY_VALUES = [
  "needs_attention",
  "quick_reply",
  "fyi",
  "newsletter",
  "promotion",
  "handled",
] as const;

/** @deprecated Use SYSTEM_INBOX_CATEGORY_VALUES */
export const INBOX_AI_CATEGORY_VALUES = SYSTEM_INBOX_CATEGORY_VALUES;

export type SystemInboxCategory = (typeof SYSTEM_INBOX_CATEGORY_VALUES)[number];

/** System slug or user personal id (custom:your_label). */
export type InboxAiCategory = SystemInboxCategory | string;

export type InboxCategoryLocale = "en" | "it";

type InboxCategoryMeta = {
  /** Manual selectors: change category, bulk move, sender rules, Teach Handled. */
  selectorOrder: number;
  /** Inbox category tabs. */
  tabOrder: number;
  /** Summary card count row order. */
  summaryOrder: number;
  /** Gmail inbox section order (full list). */
  sectionOrder: number;
  title: Record<InboxCategoryLocale, string>;
  /** Longer copy for settings dropdowns; defaults to title. */
  selectorLabel?: Partial<Record<InboxCategoryLocale, string>>;
  subtitle?: Partial<Record<InboxCategoryLocale, string>>;
  emptyMessage?: Partial<Record<InboxCategoryLocale, string>>;
  /** Rough seconds-per-email for inbox-zero estimates. */
  clearSeconds: number;
  /** Sender-memory / correction-learning priority (higher = more urgent). */
  learnPriority: number;
  /** Newsletter + promotion — collapsed in Clean mode. */
  isClutter?: boolean;
  /** Shown on the dedicated category tab when clutter is hidden from the main workflow. */
  tabGuidance?: Partial<Record<InboxCategoryLocale, string>>;
  /** Tailwind classes for gmail-inbox-card left border. */
  cardAccentClass: string;
};

const INBOX_CATEGORY_META: Record<SystemInboxCategory, InboxCategoryMeta> = {
  needs_attention: {
    selectorOrder: 0,
    tabOrder: 0,
    summaryOrder: 0,
    sectionOrder: 0,
    title: { en: "Worth your attention", it: "Da vedere" },
    subtitle: {
      en: "Worth checking when you have a moment.",
      it: "Da controllare quando hai un momento.",
    },
    emptyMessage: {
      en: "Nothing important appears to need your attention right now.",
      it: "Per ora niente di importante sembra aver bisogno di te.",
    },
    clearSeconds: 90,
    learnPriority: 5,
    cardAccentClass: "border-l-4 border-l-accent bg-accent-muted/25",
  },
  quick_reply: {
    selectorOrder: 1,
    tabOrder: 1,
    summaryOrder: 1,
    sectionOrder: 1,
    title: { en: "Quick replies", it: "Risposte veloci" },
    subtitle: {
      en: "Short replies — no heavy lifting.",
      it: "Risposte brevi — niente di pesante.",
    },
    emptyMessage: {
      en: "No conversations seem to need a quick response.",
      it: "Nessuna conversazione sembra richiedere una risposta veloce.",
    },
    clearSeconds: 40,
    learnPriority: 4,
    cardAccentClass: "border-l-4 border-l-teal-500 bg-teal-50/40",
  },
  fyi: {
    selectorOrder: 2,
    tabOrder: 2,
    summaryOrder: 2,
    sectionOrder: 2,
    title: { en: "Good to know", it: "Da sapere" },
    selectorLabel: {
      en: "Good to know (no reply needed)",
      it: "Da sapere (nessuna risposta necessaria)",
    },
    subtitle: {
      en: "Important updates — no reply needed.",
      it: "Aggiornamenti importanti — nessuna risposta necessaria.",
    },
    emptyMessage: {
      en: "No new updates to be aware of right now.",
      it: "Nessun nuovo aggiornamento da sapere per ora.",
    },
    clearSeconds: 10,
    learnPriority: 3,
    cardAccentClass: "border-l-4 border-l-sky-500 bg-sky-50/30",
  },
  handled: {
    selectorOrder: 5,
    tabOrder: 3,
    summaryOrder: 3,
    sectionOrder: 3,
    title: { en: "Can wait", it: "Possono aspettare" },
    selectorLabel: {
      en: "Handled (already quiet)",
      it: "Fatto (già tranquillo)",
    },
    subtitle: {
      en: "Informational or already quiet — safe to skim later.",
      it: "Informativi o già tranquilli — puoi leggerli dopo.",
    },
    emptyMessage: {
      en: "Everything here has already been taken care of.",
      it: "Qui è già stato sistemato tutto.",
    },
    clearSeconds: 8,
    learnPriority: 2,
    cardAccentClass: "border-l-4 border-l-emerald-500 bg-emerald-50/30",
  },
  promotion: {
    selectorOrder: 3,
    tabOrder: 4,
    summaryOrder: 4,
    sectionOrder: 5,
    title: { en: "Promotions", it: "Promozioni" },
    subtitle: {
      en: "Offers and marketing — can likely wait.",
      it: "Offerte e marketing — possono aspettare.",
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
  newsletter: {
    selectorOrder: 4,
    tabOrder: 5,
    summaryOrder: 5,
    sectionOrder: 4,
    title: { en: "Newsletters", it: "Newsletter" },
    subtitle: {
      en: "Digests and recurring reads — can likely wait.",
      it: "Digest e letture ricorrenti — possono aspettare.",
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
  return [...SYSTEM_INBOX_CATEGORY_VALUES]
    .filter((id) => (filter ? filter(INBOX_CATEGORY_META[id]) : true))
    .sort((a, b) => {
      const av = INBOX_CATEGORY_META[a][key];
      const bv = INBOX_CATEGORY_META[b][key];
      return typeof av === "number" && typeof bv === "number" ? av - bv : 0;
    });
}

/** All categories in manual-picker order (change category, bulk move, sender rules). */
export const INBOX_CATEGORY_SELECTOR_ORDER: InboxAiCategory[] = sortByMeta("selectorOrder");

/** @deprecated Prefer INBOX_CATEGORY_SELECTOR_ORDER */
export const CATEGORY_OPTIONS = INBOX_CATEGORY_SELECTOR_ORDER;

/** Inbox category tab order. */
export const INBOX_CATEGORY_TAB_ORDER: InboxAiCategory[] = sortByMeta("tabOrder");

/** Summary card count rows. */
export const INBOX_CATEGORY_SUMMARY_ORDER: InboxAiCategory[] = sortByMeta("summaryOrder");

/** Section order in the Gmail inbox (most actionable first). */
export const GMAIL_INBOX_SECTION_ORDER: InboxAiCategory[] = sortByMeta("sectionOrder");

/** Primary (non-clutter) categories for collapsed workflow modes. */
export const INBOX_CATEGORY_PRIMARY_ORDER: InboxAiCategory[] = sortByMeta(
  "sectionOrder",
  (m) => !m.isClutter,
);

/** Newsletter + promotion — grouped in Clean mode. */
export const INBOX_CLUTTER_CATEGORIES: InboxAiCategory[] = sortByMeta(
  "sectionOrder",
  (m) => Boolean(m.isClutter),
);

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

export function isSystemInboxCategory(value: string): value is SystemInboxCategory {
  return (SYSTEM_INBOX_CATEGORY_VALUES as readonly string[]).includes(value);
}

/** @deprecated Use isSystemInboxCategory */
export function isInboxAiCategory(value: string): value is SystemInboxCategory {
  return isSystemInboxCategory(value);
}

export function inboxCategoryMeta(category: SystemInboxCategory): InboxCategoryMeta {
  return INBOX_CATEGORY_META[category];
}

export function inboxCategorySectionTitle(
  category: string,
  locale: InboxCategoryLocale,
): string {
  if (isSystemInboxCategory(category)) return INBOX_CATEGORY_META[category].title[locale];
  return category;
}

/** Label for manual category selectors and settings dropdowns. */
export function inboxCategorySelectorLabel(
  category: string,
  locale: InboxCategoryLocale,
): string {
  if (!isSystemInboxCategory(category)) return category;
  const meta = INBOX_CATEGORY_META[category];
  return meta.selectorLabel?.[locale] ?? meta.title[locale];
}

export function inboxCategorySectionSubtitle(
  category: string,
  locale: InboxCategoryLocale,
): string | undefined {
  if (!isSystemInboxCategory(category)) return undefined;
  return INBOX_CATEGORY_META[category].subtitle?.[locale];
}

export function inboxCategoryEmptyMessage(
  category: string,
  locale: InboxCategoryLocale,
): string | undefined {
  if (!isSystemInboxCategory(category)) return undefined;
  return INBOX_CATEGORY_META[category].emptyMessage?.[locale];
}

/** Reassurance copy on a dedicated category tab (e.g. Promotions). */
export function inboxCategoryTabGuidance(
  category: string,
  locale: InboxCategoryLocale,
): string | undefined {
  if (!isSystemInboxCategory(category)) return undefined;
  return INBOX_CATEGORY_META[category].tabGuidance?.[locale];
}

export function inboxCategoryClearSeconds(category: string): number {
  if (!isSystemInboxCategory(category)) return 12;
  return INBOX_CATEGORY_META[category].clearSeconds;
}

export function inboxCategoryLearnPriority(category: string): number {
  if (!isSystemInboxCategory(category)) return 2;
  return INBOX_CATEGORY_META[category].learnPriority;
}

export function inboxCategoryCardAccent(category: string): string {
  if (!isSystemInboxCategory(category)) {
    return "border-l-4 border-l-violet-400 bg-violet-50/25";
  }
  return INBOX_CATEGORY_META[category].cardAccentClass;
}

/** SQL CHECK constraint body for inbox_rules.category — keep in sync with values above. */
/** System slugs only — personal categories use custom: prefix (validated in app). */
export function inboxCategorySqlCheckConstraint(): string {
  const values = SYSTEM_INBOX_CATEGORY_VALUES.map((v) => `'${v}'`).join(",\n      ");
  return `category is null or category in (\n      ${values}\n    ) or category like 'custom:%'`;
}

/** Map common model drift / synonyms to our canonical slugs. */
function synonymToCategory(t: string): SystemInboxCategory | null {
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
    t === "good_to_know" ||
    t === "goodtoknow" ||
    t === "informational" ||
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
    return "fyi";
  }
  if (
    t === "no_action" ||
    t === "noaction" ||
    t === "automated" ||
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
export function parseInboxAiCategory(
  raw: string,
  personalIds?: readonly string[],
): InboxAiCategory | null {
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const t = s.replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (isSystemInboxCategory(t)) return t;
  if (personalIds?.includes(t)) return t;
  if (personalIds?.includes(`custom:${t}`)) return `custom:${t}`;
  if (t.startsWith("custom_")) {
    const id = `custom:${t.slice(7)}`;
    if (personalIds?.includes(id)) return id;
  }
  if (t === "need_attention" || t === "needsattention") return "needs_attention";
  if (t === "quickreply") return "quick_reply";
  return synonymToCategory(t);
}

/** Legacy helper — prefer resolveCategoryWithCatalog when personal categories exist. */
export function normalizeInboxAiCategory(
  raw: string,
  personalIds?: readonly string[],
): InboxAiCategory {
  return parseInboxAiCategory(raw, personalIds) ?? "handled";
}
