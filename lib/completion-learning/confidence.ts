/** Volume-based confidence — no automation; used later for suggestion ranking. */
export function completionPatternConfidence(sampleCount: number): number {
  if (sampleCount <= 0) return 0;
  // ~0.63 at 5, ~0.86 at 10, ~0.95 at 20
  return Math.round((1 - Math.exp(-sampleCount / 8)) * 100) / 100;
}

/** Minimum samples before a pattern is suggestion-ready (future UI). */
export const COMPLETION_SUGGESTION_MIN_SAMPLES = 3;

/** Minimum confidence before a pattern is suggestion-ready (future UI). */
export const COMPLETION_SUGGESTION_MIN_CONFIDENCE = 0.45;
