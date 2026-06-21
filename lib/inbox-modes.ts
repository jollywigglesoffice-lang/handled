import {
  inboxCategorySubtitle,
  inboxCategoryTitle,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { calmEmptyMessage } from "@/lib/calm-system-copy";

export type InboxModeLocale = "en" | "it";

/** Category tab labels — use canonical inbox category names. */
export function inboxModeTitle(
  category: InboxAiCategory,
  locale: InboxModeLocale,
  catalog?: InboxCategoryCatalog,
): string {
  return inboxCategoryTitle(category, locale, catalog);
}

export function inboxModeHint(
  category: InboxAiCategory,
  locale: InboxModeLocale,
  catalog?: InboxCategoryCatalog,
): string | null {
  const subtitle = inboxCategorySubtitle(category, locale, catalog);
  return subtitle || null;
}

export function buildFocusInsightLine(
  attentionCount: number,
  locale: InboxModeLocale,
): string {
  if (attentionCount === 0) {
    return locale === "it"
      ? "Niente sembra richiedere la tua attenzione oggi."
      : "Nothing seems to need your attention today.";
  }
  if (attentionCount === 1) {
    return locale === "it"
      ? "Hai 1 email che potrebbe richiedere attenzione oggi."
      : "You have 1 email that may need attention today.";
  }
  if (attentionCount <= 3) {
    return locale === "it"
      ? `Hai ${attentionCount} email che potrebbero richiedere attenzione oggi.`
      : `You have ${attentionCount} emails that may need attention today.`;
  }
  return locale === "it"
    ? `Hai ${attentionCount} email che potrebbero richiedere attenzione — inizia dalle prime 3.`
    : `You have ${attentionCount} emails that may need attention — start with the first 3.`;
}

export function buildHandledElsewhereLine(
  count: number,
  locale: InboxModeLocale,
): string {
  if (count === 0) {
    return locale === "it" ? "Tutto il resto è gestito." : "Everything else is handled.";
  }
  if (count === 1) {
    return locale === "it"
      ? "1 altra email gestita per te."
      : "1 other email handled for you.";
  }
  return locale === "it"
    ? `${count} altre email gestite per te.`
    : `${count} other emails handled for you.`;
}

export const INBOX_ZERO_STATE_COPY = {
  en: {
    title: calmEmptyMessage("en", 2),
    subtitle: calmEmptyMessage("en", 1),
    footer: "New mail will appear here when it arrives.",
  },
  it: {
    title: calmEmptyMessage("it", 2),
    subtitle: calmEmptyMessage("it", 1),
    footer: "La nuova posta apparirà qui quando arriva.",
  },
} as const;
