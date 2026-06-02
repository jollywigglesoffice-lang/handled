import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type InboxZeroLocale = "en" | "it";

/**
 * Rough seconds-per-email by category. Used both for "time to clear" and the
 * "time saved" framing after a session. Calm, approximate — never precise.
 */
const SECONDS_PER_EMAIL: Record<InboxAiCategory, number> = {
  needs_attention: 90,
  quick_reply: 40,
  fyi: 10,
  handled: 8,
  newsletter: 6,
  promotion: 3,
};

export function secondsForCategory(category: InboxAiCategory): number {
  return SECONDS_PER_EMAIL[category];
}

export function estimateClearSeconds(counts: Record<InboxAiCategory, number>): number {
  return (Object.keys(counts) as InboxAiCategory[]).reduce(
    (total, category) => total + counts[category] * SECONDS_PER_EMAIL[category],
    0,
  );
}

/** Friendly, low-pressure duration. */
export function formatDuration(seconds: number, locale: InboxZeroLocale): string {
  if (seconds <= 0) {
    return locale === "it" ? "0 minuti" : "0 minutes";
  }
  if (seconds < 60) {
    return locale === "it" ? "meno di 1 minuto" : "less than a minute";
  }
  const minutes = Math.round(seconds / 60);
  if (locale === "it") {
    return minutes === 1 ? "1 minuto" : `${minutes} minuti`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function estimateTimeSavedSeconds(
  processed: Array<{ category: InboxAiCategory; count: number }>,
): number {
  return processed.reduce(
    (total, { category, count }) => total + count * SECONDS_PER_EMAIL[category],
    0,
  );
}
