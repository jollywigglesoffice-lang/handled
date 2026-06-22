import type { WorkStyleProfile } from "@/lib/emotional-memory/types";

type Locale = "en" | "it";

const EN = {
  default: "Welcome back — I've prepared your inbox the way you usually like it.",
  simple: "Welcome back — I've kept things simple for you.",
  lighter: "Welcome back — I've adjusted things to keep your inbox lighter.",
  actionable: "Welcome back — I'll surface what's actionable first.",
  calm: "Welcome back — take your time, nothing urgent.",
} as const;

const IT = {
  default: "Bentornato — ho preparato la inbox come ti piace di solito.",
  simple: "Bentornato — ho mantenuto le cose semplici per te.",
  lighter: "Bentornato — ho alleggerito la inbox per te.",
  actionable: "Bentornato — metto in evidenza prima ciò che richiede azione.",
  calm: "Bentornato — prenditi il tuo tempo, niente di urgente.",
} as const;

/**
 * Subtle returning-user greeting — once per session, never references
 * inferred emotional states or specific past days.
 */
export function pickReturningWelcome(
  profile: WorkStyleProfile,
  locale: Locale,
  isReturning: boolean,
): string | null {
  if (!isReturning) return null;
  if (typeof window !== "undefined") {
    try {
      if (sessionStorage.getItem("handled:emotional-welcome-shown")) return null;
      sessionStorage.setItem("handled:emotional-welcome-shown", "1");
    } catch {
      /* ignore */
    }
  }

  const copy = locale === "it" ? IT : EN;

  if (profile.densityPreference === "minimal" || profile.filteringStrength === "aggressive") {
    return profile.filteringStrength === "aggressive" ? copy.lighter : copy.simple;
  }
  if (profile.pace === "fast_responder") return copy.actionable;
  if (profile.emotionalTone === "calm") return copy.calm;
  return copy.default;
}

/** Secondary continuity line under the headline — optional, sparse. */
export function pickReturningSubline(
  profile: WorkStyleProfile,
  locale: Locale,
): string | null {
  const en = {
    minimal: "I've kept things minimal — fewer emails up front.",
    aggressive: "Low-priority mail stays tucked away until you want it.",
    exploratory: "A wider mix when you're ready to browse.",
  };
  const it = {
    minimal: "Ho mantenuto il minimo — meno email in evidenza.",
    aggressive: "Il resto resta da parte finché non ti serve.",
    exploratory: "Un mix più ampio quando vuoi esplorare.",
  };
  const copy = locale === "it" ? it : en;

  if (profile.densityPreference === "minimal") return copy.minimal;
  if (profile.filteringStrength === "aggressive") return copy.aggressive;
  if (profile.pace === "exploratory") return copy.exploratory;
  return null;
}
