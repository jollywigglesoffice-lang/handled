import type { VoiceContext, VoiceLocale } from "@/lib/voice/identity";
import { VOICE } from "@/lib/voice/copy";

/** Pick copy for a context — personality stays identical, phrasing shifts subtly. */
export function pickVoiceLine(
  locale: VoiceLocale,
  context: VoiceContext,
  seed = 0,
): string | null {
  const abs = Math.abs(seed);
  switch (context) {
    case "loading":
      return VOICE[locale].loading.inbox[abs % VOICE[locale].loading.inbox.length]!;
    case "empty":
      return VOICE[locale].empty.lines[abs % VOICE[locale].empty.lines.length]!;
    case "stress":
      return VOICE[locale].stress.headlines[abs % VOICE[locale].stress.headlines.length]!;
    case "error":
      return VOICE[locale].error.genericBody;
    case "onboarding":
      return VOICE[locale].onboarding.headline;
    case "success":
      return null;
    case "normal":
    default:
      return null;
  }
}

export function voiceOnboardingHeadline(locale: VoiceLocale): string {
  return VOICE[locale].onboarding.headline;
}

export function voiceOnboardingFallback(
  locale: VoiceLocale,
): { title: string; body: string } {
  const o = VOICE[locale].onboarding;
  return { title: o.fallbackTitle, body: o.fallbackBody };
}
