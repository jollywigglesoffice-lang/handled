import {
  EMPTY_CATEGORY_CATALOG,
  inboxCategoryEmptyCopy,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

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
  en: [
    "Everything important looks under control.",
    "Nothing urgent appears unresolved.",
    "You're caught up enough for now.",
    "Handled cleared the noise.",
  ],
  it: [
    "Tutto l'importante sembra sotto controllo.",
    "Niente di urgente sembra irrisolto.",
    "Per ora sei a posto.",
    "Handled ha tolto il rumore.",
  ],
};

const COMPLETION_SUBTITLES: Record<EmptyStateLocale, string[]> = {
  en: [
    "You don't need to keep checking — Handled will surface anything that matters.",
    "Step away when you want. New mail will appear here when it arrives.",
    "The quiet is real. Nothing is waiting on you right now.",
    "Low-priority mail is set aside for whenever you want it.",
  ],
  it: [
    "Non serve continuare a controllare — Handled farà emergere ciò che conta.",
    "Stacca quando vuoi. La nuova posta apparirà qui quando arriva.",
    "La calma è reale. Niente ti sta aspettando adesso.",
    "La posta a bassa priorità è da parte per quando vuoi.",
  ],
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
