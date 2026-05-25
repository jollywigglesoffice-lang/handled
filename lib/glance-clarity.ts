import type { IntelligenceVerbosity } from "@/lib/intelligence-quiet";
import { maxAmbientLines, maxContextChips } from "@/lib/intelligence-quiet";

export type GlanceLocale = "en" | "it";

export type GlanceInput = {
  summary: string;
  nextStep?: string | null;
  ambientLines?: string[];
  chips?: string[];
  haystack?: string;
  locale: GlanceLocale;
  verbosity?: IntelligenceVerbosity;
};

export type GlancePresentation = {
  primary: string;
  secondary: string | null;
  chips: string[];
  /** When next step stays separate (rare — full verbosity only). */
  nextStep: string | null;
};

const GENERIC_NEXT =
  /^(reply when|rispondi quando|archive when|archivia quando|pick a time|scegli un orario)/i;

const CHIP_PRIORITY =
  /scheduling|appuntamento|reschedule|riprenot|worth checking|da vedere|payment|pagamento|school|scuola|decision|decisione|support|supporto/i;

/** Deadline tail for one-glance urgency — e.g. “before 6 PM”. */
export function extractDeadlinePhrase(hay: string, locale: GlanceLocale): string | null {
  const h = hay.toLowerCase();

  const beforeClock = hay.match(
    /\b(?:before|by|entro(?:\s+le)?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i,
  );
  if (beforeClock?.[1]) {
    const t = beforeClock[1].trim();
    return locale === "it" ? `entro le ${t}` : `before ${t}`;
  }

  const todayEod = /\b(?:today|oggi)\b.*\b(?:eod|end of day|fine giornata|stasera)\b/i.test(hay);
  if (todayEod) {
    return locale === "it" ? "entro stasera" : "before end of day";
  }

  const weekday = hay.match(
    /\b(?:by|before|entro)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b/i,
  );
  if (weekday?.[1]) {
    return locale === "it" ? `entro ${weekday[1]}` : `by ${weekday[1]}`;
  }

  if (/\b(?:asap|urgent|urgente|immediately|subito)\b/i.test(h) && !/\bno rush|non urgente\b/i.test(h)) {
    return locale === "it" ? "quando puoi, ma presto" : "soon";
  }

  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function linesOverlap(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 14 && nb.length > 14 && (na.includes(nb) || nb.includes(na))) return true;
  const aWords = new Set(na.split(" ").filter((w) => w.length > 3));
  let shared = 0;
  for (const w of nb.split(" ")) {
    if (w.length > 3 && aWords.has(w)) shared += 1;
  }
  const minLen = Math.min(aWords.size, nb.split(" ").filter((w) => w.length > 3).length);
  return minLen >= 3 && shared / minLen >= 0.55;
}

function appendDeadlineIfMissing(
  summary: string,
  haystack: string | undefined,
  locale: GlanceLocale,
): string {
  if (!haystack?.trim()) return summary;
  const deadline = extractDeadlinePhrase(haystack, locale);
  if (!deadline || normalize(summary).includes(normalize(deadline))) return summary;

  const needsConfirm = /pickup|ritiro|confirm|conferm|school|scuola/i.test(haystack);
  if (!needsConfirm && !/deadline|due|entro|before|by\s+\d/i.test(haystack)) return summary;

  const base = summary.replace(/\.\s*$/, "");
  if (locale === "it") {
    return `${base} — ${deadline}.`;
  }
  return `${base} — ${deadline}.`;
}

function fusePrimaryAndNext(primary: string, next: string): string {
  if (linesOverlap(next, primary)) return primary;
  const base = primary.replace(/\.\s*$/, "").trim();
  const step = next.replace(/\.\s*$/, "").trim();
  const lowered =
    step.charAt(0) === step.charAt(0).toUpperCase()
      ? step.charAt(0).toLowerCase() + step.slice(1)
      : step;
  return `${base} — ${lowered}.`;
}

function pickPriorityChips(chips: string[], max: number): string[] {
  if (max <= 0 || chips.length === 0) return [];
  const ranked = [...chips].sort((a, b) => {
    const pa = CHIP_PRIORITY.test(a) ? 1 : 0;
    const pb = CHIP_PRIORITY.test(b) ? 1 : 0;
    return pb - pa;
  });
  return ranked.slice(0, max);
}

function chipRedundantWithPrimary(chip: string, primary: string): boolean {
  const p = normalize(primary);
  const c = normalize(chip);
  if (/school|scuola/.test(c) && /school|scuola|pickup|ritiro/.test(p)) return true;
  if (/scheduling|appuntamento/.test(c) && /schedule|appuntament|orari|time/.test(p)) return true;
  if (/reply when|risposta quando/.test(c) && /reply|rispond|risposta/.test(p)) return true;
  if (/can wait|può aspettare/.test(c) && /wait|aspett|later|dopo/.test(p)) return true;
  return linesOverlap(chip, primary);
}

function isWeakSummary(summary: string): boolean {
  return /needs attention|likely needs|to review|da valutare|messaggio da/i.test(summary);
}

/**
 * One-glance understanding — single primary line, optional whisper, minimal chips.
 */
export function buildGlancePresentation(input: GlanceInput): GlancePresentation {
  const verbosity = input.verbosity ?? "full";
  const locale = input.locale;
  const ambientCap = maxAmbientLines(verbosity);
  const chipCap = maxContextChips(verbosity);

  let primary = appendDeadlineIfMissing(
    input.summary.trim(),
    input.haystack,
    locale,
  );

  let nextStep = input.nextStep?.trim() || null;
  if (nextStep && (GENERIC_NEXT.test(nextStep) || linesOverlap(nextStep, primary))) {
    nextStep = null;
  }

  if (nextStep) {
    if (verbosity === "minimal" || isWeakSummary(primary) || nextStep.length < 72) {
      primary = fusePrimaryAndNext(primary, nextStep);
      nextStep = null;
    }
  }

  let secondary: string | null = null;
  for (const line of input.ambientLines ?? []) {
    if (ambientCap === 0) break;
    const trimmed = line.trim();
    if (!trimmed || linesOverlap(trimmed, primary)) continue;
    secondary = trimmed;
    break;
  }

  let chips = pickPriorityChips(input.chips ?? [], chipCap).filter(
    (c) => !chipRedundantWithPrimary(c, primary) && !secondary?.includes(c),
  );

  if (verbosity === "minimal") {
    chips = [];
  }

  return { primary, secondary, chips, nextStep };
}

/** Inbox list — subject-first scanning with one contextual line. */
export function buildInboxGlanceLine(
  summary: string,
  options: {
    continuityLine?: string | null;
    nextStep?: string | null;
    haystack?: string;
    locale: GlanceLocale;
  },
): string {
  const glance = buildGlancePresentation({
    summary,
    nextStep: options.nextStep ?? null,
    ambientLines: options.continuityLine ? [options.continuityLine] : [],
    chips: [],
    haystack: options.haystack,
    locale: options.locale,
    verbosity: "compact",
  });
  return glance.secondary
    ? `${glance.primary} ${glance.secondary}`.replace(/\s+/g, " ").trim()
    : glance.primary;
}
