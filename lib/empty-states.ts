import {
  EMPTY_CATEGORY_CATALOG,
  inboxCategoryEmptyCopy,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { voiceEmptyLines, VOICE } from "@/lib/voice";

export type EmptyStateLocale = "en" | "it";

export function categoryEmptyMessage(
  category: InboxAiCategory,
  locale: EmptyStateLocale,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): string {
  return inboxCategoryEmptyCopy(category, locale, catalog);
}

/**
 * Inbox-wide completion lines — calm confidence, never accomplishment.
 * Rotated naturally so the inbox never repeats the same phrase every time.
 */
const COMPLETION_TITLES: Record<EmptyStateLocale, string[]> = {
  en: [...voiceEmptyLines("en"), "Handled cleared the noise."],
  it: [...voiceEmptyLines("it"), "Handled ha tolto il rumore."],
};

const COMPLETION_SUBTITLES: Record<EmptyStateLocale, string[]> = {
  en: [...VOICE.en.empty.completionSubtitles],
  it: [...VOICE.it.empty.completionSubtitles],
};

export type InboxCompletionCopy = {
  title: string;
  subtitle: string;
};

export function inboxCompletionCopy(
  locale: EmptyStateLocale,
  seed = Date.now(),
): InboxCompletionCopy {
  const titles = COMPLETION_TITLES[locale];
  const subtitles = COMPLETION_SUBTITLES[locale];
  const idx = Math.abs(Math.floor(seed)) % titles.length;
  return {
    title: titles[idx]!,
    subtitle: subtitles[idx]!,
  };
}

export function rotatingCompletionSeed(): number {
  return Math.floor(Date.now() / (1000 * 60 * 20));
}
