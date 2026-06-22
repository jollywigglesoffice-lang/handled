import type { CalmModeLevel } from "@/lib/inbox-stress/types";
import {
  voiceStressHeadline,
  voiceStressReassurance,
  voiceStressRecovery,
  type VoiceLocale,
} from "@/lib/voice";

type Locale = VoiceLocale;

export function pickCalmHeadline(locale: Locale, score: number): string {
  return voiceStressHeadline(locale, Math.floor(score / 20));
}

export function pickCalmReassurance(locale: Locale, score: number): string {
  return voiceStressReassurance(locale, Math.floor(score / 15) + 1);
}

export function pickCalmRecoveryLine(locale: Locale): string {
  return voiceStressRecovery(locale);
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
