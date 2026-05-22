import type { CommunicationProfileId, ResolvedDraftStyle } from "@/lib/draft-memory/types";

export function buildStyleIndicator(
  resolved: ResolvedDraftStyle,
  locale: "en" | "it",
): { label: string; detail?: string } {
  const { profileId, confidence } = resolved;

  const learned = confidence === "learned";

  const en: Record<CommunicationProfileId, { base: string; learned: string }> = {
    school: {
      base: "School communication style",
      learned: "Using your school communication style",
    },
    business: {
      base: "Professional client tone",
      learned: "Using your usual client tone",
    },
    personal: {
      base: "Warm personal tone",
      learned: "Using your natural personal tone",
    },
    formal: {
      base: "Formal, calm tone",
      learned: "Using your formal style",
    },
    multilingual: {
      base: "Multilingual style",
      learned: "Using your bilingual style",
    },
    balanced: {
      base: "Balanced tone",
      learned: "Using your concise style",
    },
  };

  const it: Record<CommunicationProfileId, { base: string; learned: string }> = {
    school: {
      base: "Stile scuola",
      learned: "Stile scuola che usi di solito",
    },
    business: {
      base: "Tono professionale",
      learned: "Tono clienti che usi di solito",
    },
    personal: {
      base: "Tono personale caldo",
      learned: "Tono personale naturale",
    },
    formal: {
      base: "Tono formale calmo",
      learned: "Il tuo stile formale",
    },
    multilingual: {
      base: "Stile multilingue",
      learned: "Il tuo stile bilingue",
    },
    balanced: {
      base: "Tono equilibrato",
      learned: "Il tuo stile conciso",
    },
  };

  const map = locale === "it" ? it : en;
  const entry = map[profileId] ?? map.balanced;
  const label = learned ? entry.learned : entry.base;

  if (resolved.dimensions.sentenceLength === "concise" && learned) {
    return {
      label: locale === "it" ? "Stile conciso che preferisci" : "Using your concise style",
      detail: resolved.indicatorDetail,
    };
  }

  return { label, detail: resolved.indicatorDetail };
}
