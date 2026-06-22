/** Familiarity — Handled speaks less as trust builds (local only). */

import {
  readEmotionalMemory,
  resolveAdaptiveInboxSettings,
  recordEmotionalAction,
} from "@/lib/emotional-memory";

const STORAGE_KEY = "handled:familiarity:v1";

export type IntelligenceVerbosity = "full" | "compact" | "minimal";

type FamiliarityState = {
  emailOpens: number;
  firstSeenAt: number;
};

function readState(): FamiliarityState {
  if (typeof window === "undefined") {
    return { emailOpens: 0, firstSeenAt: Date.now() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { emailOpens: 0, firstSeenAt: Date.now() };
    const parsed = JSON.parse(raw) as Partial<FamiliarityState>;
    return {
      emailOpens: typeof parsed.emailOpens === "number" ? parsed.emailOpens : 0,
      firstSeenAt: typeof parsed.firstSeenAt === "number" ? parsed.firstSeenAt : Date.now(),
    };
  } catch {
    return { emailOpens: 0, firstSeenAt: Date.now() };
  }
}

function writeState(state: FamiliarityState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

/** Call when the user opens an email detail — increments local familiarity. */
export function recordEmailEngagement(): void {
  const state = readState();
  writeState({ ...state, emailOpens: state.emailOpens + 1 });
  recordEmotionalAction("open");
}

export function getEmailEngagementCount(): number {
  return readState().emailOpens;
}

export function getIntelligenceVerbosity(): IntelligenceVerbosity {
  const opens = readState().emailOpens;
  let level: IntelligenceVerbosity;
  if (opens >= 28) level = "minimal";
  else if (opens >= 10) level = "compact";
  else level = "full";

  if (level === "full" && resolveAdaptiveInboxSettings(readEmotionalMemory()).compactExplanations) {
    return "compact";
  }
  return level;
}

export function maxContextChips(verbosity: IntelligenceVerbosity): number {
  if (verbosity === "minimal") return 0;
  if (verbosity === "compact") return 1;
  return 2;
}

export function maxAmbientLines(verbosity: IntelligenceVerbosity): number {
  if (verbosity === "minimal") return 0;
  return 1;
}

/** Hide performative “Likely ·” framing for experienced users. */
export function showExplicitNextStepLabel(verbosity: IntelligenceVerbosity): boolean {
  return verbosity === "full";
}
