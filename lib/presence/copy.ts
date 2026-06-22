import type { PresenceLocale, PresenceObservation } from "@/lib/presence/types";

/** Quiet observations — never "we detected" or "AI analyzed". */
const OBSERVATIONS: Record<
  PresenceLocale,
  Record<PresenceObservation, string>
> = {
  en: {
    prioritized: "Prioritized for you",
    organized_away: "Organized while you were away",
    filtered_clarity: "Filtered for clarity",
    already_ready: "Ready when you are",
    kept_simple: "Kept simple while you were away",
  },
  it: {
    prioritized: "Prioritizzato per te",
    organized_away: "Organizzato mentre eri via",
    filtered_clarity: "Filtrato per chiarezza",
    already_ready: "Pronto quando vuoi",
    kept_simple: "Tenuto semplice mentre eri via",
  },
};

export function presenceObservationLine(
  observation: PresenceObservation,
  locale: PresenceLocale,
): string {
  return OBSERVATIONS[locale][observation];
}
