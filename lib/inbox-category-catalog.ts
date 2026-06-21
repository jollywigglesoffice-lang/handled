import {
  GMAIL_INBOX_SECTION_ORDER,
  INBOX_CATEGORY_PRIMARY_ORDER,
  INBOX_CATEGORY_SELECTOR_ORDER,
  INBOX_CATEGORY_SUMMARY_ORDER,
  INBOX_CATEGORY_TAB_ORDER,
  INBOX_CLUTTER_CATEGORIES,
  inboxCategoryCardAccent,
  inboxCategoryClearSeconds,
  inboxCategoryEmptyMessage,
  inboxCategoryLearnPriority,
  inboxCategorySectionSubtitle,
  inboxCategorySectionTitle,
  inboxCategorySelectorLabel,
  coerceLegacyInboxCategory,
  isSystemInboxCategory,
  SYSTEM_INBOX_CATEGORY_VALUES,
  type InboxAiCategory,
  type InboxCategoryLocale,
  type SystemInboxCategory,
} from "@/lib/inbox-ai-categories";

export type { InboxAiCategory, InboxCategoryLocale, SystemInboxCategory };
import { isPersonalInboxCategoryId } from "@/lib/personal-categories/slug";
import type { PersonalInboxCategory } from "@/lib/personal-categories/types";

const PERSONAL_CARD_ACCENT =
  "border-l-4 border-l-violet-400 bg-violet-50/25";
const PERSONAL_CLEAR_SECONDS = 12;
const PERSONAL_LEARN_PRIORITY = 2;

export type InboxCategoryCatalog = {
  personal: PersonalInboxCategory[];
  personalIds: InboxAiCategory[];
  /** System + personal ids */
  allIds: InboxAiCategory[];
  selectorOrder: InboxAiCategory[];
  tabOrder: InboxAiCategory[];
  summaryOrder: InboxAiCategory[];
  sectionOrder: InboxAiCategory[];
  primaryOrder: InboxAiCategory[];
  clutterCategories: InboxAiCategory[];
};

export const EMPTY_CATEGORY_CATALOG = buildInboxCategoryCatalog([]);

export function buildInboxCategoryCatalog(
  personal: PersonalInboxCategory[],
): InboxCategoryCatalog {
  const personalIds = personal.map((p) => p.id as InboxAiCategory);
  const personalSorted = [...personal].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
  const pIds = personalSorted.map((p) => p.id as InboxAiCategory);

  const insertPersonal = (base: InboxAiCategory[]): InboxAiCategory[] => {
    const clutterStart = base.findIndex((id) =>
      INBOX_CLUTTER_CATEGORIES.includes(id as SystemInboxCategory),
    );
    if (clutterStart === -1) return [...base, ...pIds];
    return [...base.slice(0, clutterStart), ...pIds, ...base.slice(clutterStart)];
  };

  return {
    personal: personalSorted,
    personalIds: pIds,
    allIds: [...SYSTEM_INBOX_CATEGORY_VALUES, ...pIds],
    selectorOrder: [...INBOX_CATEGORY_SELECTOR_ORDER, ...pIds],
    tabOrder: insertPersonal(INBOX_CATEGORY_TAB_ORDER),
    summaryOrder: insertPersonal(INBOX_CATEGORY_SUMMARY_ORDER),
    sectionOrder: insertPersonal(GMAIL_INBOX_SECTION_ORDER),
    primaryOrder: [...INBOX_CATEGORY_PRIMARY_ORDER, ...pIds],
    clutterCategories: [...INBOX_CLUTTER_CATEGORIES],
  };
}

export function catalogHasCategory(
  catalog: InboxCategoryCatalog,
  category: string,
): boolean {
  return catalog.allIds.includes(category);
}

export function resolveCategoryWithCatalog(
  raw: string,
  catalog: InboxCategoryCatalog,
): InboxAiCategory {
  const s = String(raw).trim();
  if (!s) return "good_to_know";
  const coerced = coerceLegacyInboxCategory(s);
  if (isSystemInboxCategory(coerced)) return coerced;
  if (catalog.personalIds.includes(coerced)) return coerced;
  const normalized = s.replace(/[\s-]+/g, "_").toLowerCase();
  const coercedNorm = coerceLegacyInboxCategory(normalized);
  if (isSystemInboxCategory(coercedNorm)) return coercedNorm;
  if (catalog.personalIds.includes(normalized)) return normalized;
  const prefixed = normalized.startsWith("custom:") ? normalized : `custom:${normalized}`;
  if (catalog.personalIds.includes(prefixed)) return prefixed;
  for (const p of catalog.personal) {
    const labelSlug = p.label.toLowerCase().replace(/[\s-]+/g, "_");
    if (labelSlug === normalized || p.id === prefixed) return p.id as InboxAiCategory;
  }
  return "good_to_know";
}

export function inboxCategoryTitle(
  category: string,
  locale: InboxCategoryLocale,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): string {
  if (isSystemInboxCategory(category)) {
    return inboxCategorySectionTitle(category, locale);
  }
  const p = catalog.personal.find((c) => c.id === category);
  if (p) return locale === "it" && p.labelIt ? p.labelIt : p.label;
  if (isPersonalInboxCategoryId(category)) {
    return category.slice("custom:".length).replace(/_/g, " ");
  }
  return category;
}

export function inboxCategorySelectorTitle(
  category: string,
  locale: InboxCategoryLocale,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): string {
  if (isSystemInboxCategory(category)) {
    return inboxCategorySelectorLabel(category, locale);
  }
  return inboxCategoryTitle(category, locale, catalog);
}

export function inboxCategorySubtitle(
  category: string,
  locale: InboxCategoryLocale,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): string | undefined {
  if (isSystemInboxCategory(category)) {
    return inboxCategorySectionSubtitle(category, locale);
  }
  if (catalog.personal.some((p) => p.id === category)) {
    return locale === "it"
      ? "Le tue email personali — nessuna risposta richiesta."
      : "Your personal bucket — no reply expected.";
  }
  return undefined;
}

export function inboxCategoryEmptyCopy(
  category: string,
  locale: InboxCategoryLocale,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): string {
  if (isSystemInboxCategory(category)) {
    return (
      inboxCategoryEmptyMessage(category, locale) ??
      (locale === "it" ? "Niente qui per ora." : "Nothing here for now.")
    );
  }
  const name = inboxCategoryTitle(category, locale, catalog);
  return locale === "it"
    ? `Nessuna email in ${name} per ora.`
    : `No emails in ${name} right now.`;
}

export function inboxCategoryAccent(
  category: string,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): string {
  if (isSystemInboxCategory(category)) return inboxCategoryCardAccent(category);
  if (catalog.personal.some((p) => p.id === category)) return PERSONAL_CARD_ACCENT;
  return PERSONAL_CARD_ACCENT;
}

export function inboxCategorySeconds(
  category: string,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): number {
  if (isSystemInboxCategory(category)) return inboxCategoryClearSeconds(category);
  if (catalog.personal.some((p) => p.id === category)) return PERSONAL_CLEAR_SECONDS;
  return PERSONAL_CLEAR_SECONDS;
}

export function inboxCategoryPriority(
  category: string,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): number {
  if (isSystemInboxCategory(category)) return inboxCategoryLearnPriority(category);
  if (catalog.personal.some((p) => p.id === category)) return PERSONAL_LEARN_PRIORITY;
  return 1;
}

export function personalCategoriesForAiPrompt(
  catalog: InboxCategoryCatalog,
): string {
  if (!catalog.personal.length) return "";
  return catalog.personal
    .map((p) => {
      const hint = p.hint ? ` — ${p.hint}` : "";
      return `${p.id} (${p.label})${hint}`;
    })
    .join("\n");
}

export function initCategoryCounts(
  catalog: InboxCategoryCatalog,
): Record<string, number> {
  return Object.fromEntries(catalog.allIds.map((id) => [id, 0]));
}

export function initCategoryBuckets<T>(catalog: InboxCategoryCatalog): Record<string, T[]> {
  return Object.fromEntries(catalog.allIds.map((id) => [id, [] as T[]])) as Record<string, T[]>;
}
