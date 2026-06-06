/** Volume-based confidence — no automation; used for suggestion ranking. */
export function completionPatternConfidence(sampleCount: number): number {
  if (sampleCount <= 0) return 0;
  // ~0.63 at 5, ~0.86 at 10, ~0.95 at 20
  return Math.round((1 - Math.exp(-sampleCount / 8)) * 100) / 100;
}

/** Minimum times the top action was chosen within a signal group (e.g. 11 of 12). */
export const COMPLETION_SUGGESTION_MIN_TOP_SAMPLES = 5;

/** Minimum completions in the signal group (all actions combined). */
export const COMPLETION_SUGGESTION_MIN_SIMILAR_TOTAL = 5;

/** Top action must win this share of similar emails (11/12 ≈ 0.92; 2/10 = 0.2). */
export const COMPLETION_SUGGESTION_MIN_DOMINANCE = 0.85;

/** Combined dominance × volume score floor for detail-page suggestions. */
export const COMPLETION_SUGGESTION_MIN_CONFIDENCE = 0.55;

/** Stricter bar for the optional inbox “Likely” badge. */
export const COMPLETION_INBOX_BADGE_MIN_TOP_SAMPLES = 8;
export const COMPLETION_INBOX_BADGE_MIN_DOMINANCE = 0.9;

/** @deprecated use COMPLETION_SUGGESTION_MIN_TOP_SAMPLES */
export const COMPLETION_SUGGESTION_MIN_SAMPLES = COMPLETION_SUGGESTION_MIN_TOP_SAMPLES;
