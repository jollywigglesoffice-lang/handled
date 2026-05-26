/** Human, calm-confidence language — no scores, no assistant narration. */

export type CalmLocale = "en" | "it";

export type DayPhase = "morning" | "afternoon" | "evening";

/** Nothing pressing in the attention queue. */
export function calmNothingPressing(phase: DayPhase, locale: CalmLocale): string {
  if (locale === "it") {
    if (phase === "morning") return "Niente di pressante in attesa oggi.";
    if (phase === "evening") return "Niente di pressante in attesa stasera.";
    return "Niente di pressante in attesa.";
  }
  if (phase === "morning") return "Nothing pressing on your plate today.";
  if (phase === "evening") return "Nothing pressing tonight.";
  return "Nothing pressing right now.";
}

/** Small attention queue — confidence without counting stress. */
export function calmFewNeedYou(count: number, locale: CalmLocale): string {
  if (locale === "it") {
    if (count <= 1) return "Solo una cosa potrebbe richiederti oggi.";
    if (count <= 4) return "Solo poche cose richiedono davvero attenzione adesso.";
    return "Qualche conversazione potrebbe ancora richiederti — il resto può aspettare.";
  }
  if (count <= 1) return "Only one thing may actually need you today.";
  if (count <= 4) return "Only a few things actually need attention right now.";
  return "A few conversations may still need you — most of the rest can wait.";
}

/** Broader queue — closure framing, not urgency. */
export function calmOpenThreads(phase: DayPhase, locale: CalmLocale): string {
  if (locale === "it") {
    if (phase === "evening") return "Qualche thread aperto — può aspettare fino a domani.";
    if (phase === "morning") return "Qualche conversazione oggi — il resto può aspettare.";
    return "Un paio di conversazioni potrebbero ancora chiudersi — senza fretta.";
  }
  if (phase === "evening") return "A few open threads — fine to leave until tomorrow.";
  if (phase === "morning") return "A few conversations today — the rest can wait.";
  return "A couple of conversations may still need closure.";
}

export function calmMostManageable(locale: CalmLocale): string {
  return locale === "it"
    ? "La maggior parte della inbox sembra gestibile."
    : "Most things look manageable.";
}

/** Section / batch reassurance — not “urgent”. */
export function calmCanLikelyWait(locale: CalmLocale): string {
  return locale === "it"
    ? "Probabilmente può aspettare."
    : "This probably isn't urgent.";
}

export function calmWorthCheckingToday(locale: CalmLocale): string {
  return locale === "it" ? "Da vedere oggi." : "Worth checking today.";
}

export function calmTimeSensitiveHere(locale: CalmLocale): string {
  return locale === "it"
    ? "Niente di pressante qui — apri quando vuoi."
    : "Nothing time-sensitive here — open when you want.";
}

/** Strip “Handled …” / “AI …” prefixes for direct guidance. */
export function directGuidanceLine(text: string): string {
  return text
    .replace(/^handled\s+(thinks|suggests|detected|noticed|found|will|can)\s+/i, "")
    .replace(/^ai\s+detected\s+/i, "")
    .replace(/^l['']?ia\s+ha\s+rilevato\s+/i, "")
    .trim();
}
