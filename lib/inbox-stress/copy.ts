import type { CalmModeLevel } from "@/lib/inbox-stress/types";

type Locale = "en" | "it";

const EN = {
  headline: [
    "Let's take this one step at a time.",
    "We'll clear the important things first.",
    "No need to handle everything now.",
  ],
  reassurance: [
    "We don't need to finish everything right now.",
    "I'll help you get back to a calm inbox.",
    "We can go at your pace.",
  ],
  recovery: "Things look lighter — I'll show you a bit more when you're ready.",
} as const;

const IT = {
  headline: [
    "Un passo alla volta.",
    "Partiamo dalle cose importanti.",
    "Non serve gestire tutto adesso.",
  ],
  reassurance: [
    "Non dobbiamo finire tutto adesso.",
    "Ti aiuto a tornare a una inbox tranquilla.",
    "Andiamo con calma.",
  ],
  recovery: "Sembra più leggero — ti mostro un po' di più quando vuoi.",
} as const;

function pickStable<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length]!;
}

export function pickCalmHeadline(locale: Locale, score: number): string {
  const copy = locale === "it" ? IT : EN;
  return pickStable(copy.headline, Math.floor(score / 20));
}

export function pickCalmReassurance(locale: Locale, score: number): string {
  const copy = locale === "it" ? IT : EN;
  return pickStable(copy.reassurance, Math.floor(score / 15) + 1);
}

export function pickCalmRecoveryLine(locale: Locale): string {
  return locale === "it" ? IT.recovery : EN.recovery;
}

export function calmModeActiveCopy(
  locale: Locale,
  level: CalmModeLevel,
  score: number,
  recovering: boolean,
): { headline: string | null; reassurance: string | null } {
  if (level !== "calm") return { headline: null, reassurance: null };
  return {
    headline: recovering ? pickCalmRecoveryLine(locale) : pickCalmHeadline(locale, score),
    reassurance: recovering ? null : pickCalmReassurance(locale, score),
  };
}
