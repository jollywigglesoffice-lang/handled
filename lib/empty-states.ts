import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type EmptyStateLocale = "en" | "it";

/**
 * Calm, contextual per-category empty copy.
 * Reinforces "nothing needs me" rather than "the box is empty".
 */
const CATEGORY_EMPTY: Record<EmptyStateLocale, Record<InboxAiCategory, string>> = {
  en: {
    needs_attention: "Nothing important appears to need your attention right now.",
    quick_reply: "No conversations seem to need a quick response.",
    handled: "Everything here has already been taken care of.",
    newsletter: "No newsletters are waiting.",
    promotion: "No promotional emails are waiting.",
  },
  it: {
    needs_attention: "Per ora niente di importante sembra aver bisogno di te.",
    quick_reply: "Nessuna conversazione sembra richiedere una risposta veloce.",
    handled: "Qui è già stato sistemato tutto.",
    newsletter: "Nessuna newsletter in attesa.",
    promotion: "Nessuna email promozionale in attesa.",
  },
};

export function categoryEmptyMessage(
  category: InboxAiCategory,
  locale: EmptyStateLocale,
): string {
  return CATEGORY_EMPTY[locale][category];
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

/**
 * Pick a completion line. `seed` keeps it stable for a render/session while
 * still rotating naturally across visits (callers pass a time- or visit-based seed).
 */
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

/** Stable-per-session seed that still rotates between visits. */
export function rotatingCompletionSeed(): number {
  // Changes roughly every 20 minutes — natural rotation without flicker.
  return Math.floor(Date.now() / (1000 * 60 * 20));
}
