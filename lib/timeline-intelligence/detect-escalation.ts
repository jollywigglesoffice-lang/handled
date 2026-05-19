export type EscalationSignals = {
  score: number;
  reasons: string[];
  followUpOrdinal?: number;
};

const ESCALATION_PATTERNS: Array<{ pattern: RegExp; weight: number; reason: string }> = [
  { pattern: /\bfollowing up again\b/i, weight: 22, reason: "following_up_again" },
  { pattern: /\bsecond reminder\b/i, weight: 28, reason: "second_reminder" },
  { pattern: /\bthird (?:reminder|follow[- ]?up)\b/i, weight: 35, reason: "third_reminder" },
  { pattern: /\b(?:final|last) reminder\b/i, weight: 30, reason: "final_reminder" },
  { pattern: /\burgent\b/i, weight: 18, reason: "urgent" },
  { pattern: /\basap\b/i, weight: 16, reason: "asap" },
  { pattern: /\bdeadline tomorrow\b/i, weight: 26, reason: "deadline_tomorrow" },
  { pattern: /\btime.?sensitive\b/i, weight: 14, reason: "time_sensitive" },
  { pattern: /\bstill (?:waiting|haven'?t heard)\b/i, weight: 12, reason: "still_waiting" },
  { pattern: /\bper my (?:last|previous) email\b/i, weight: 15, reason: "per_previous_email" },
  { pattern: /\b(?:re:|fwd:){2,}/i, weight: 10, reason: "deep_thread" },
];

const ORDINAL_FOLLOW_UP = /\b(second|third|fourth|\d+(?:st|nd|rd|th))\s+(?:reminder|follow[- ]?up)\b/i;

export function detectEscalation(hay: string, subject: string): EscalationSignals {
  const combined = `${subject} ${hay}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  for (const { pattern, weight, reason } of ESCALATION_PATTERNS) {
    if (pattern.test(combined)) {
      score += weight;
      reasons.push(reason);
    }
  }

  const ordinal = combined.match(ORDINAL_FOLLOW_UP);
  let followUpOrdinal: number | undefined;
  if (ordinal?.[1]) {
    const word = ordinal[1].toLowerCase();
    followUpOrdinal =
      word === "second" ? 2 : word === "third" ? 3 : word === "fourth" ? 4 : parseInt(word, 10) || undefined;
    if (followUpOrdinal && followUpOrdinal >= 2) {
      score += followUpOrdinal * 8;
      reasons.push(`follow_up_${followUpOrdinal}`);
    }
  }

  const reCount = (subject.match(/\bre:\s/gi) ?? []).length;
  if (reCount >= 2) {
    score += reCount * 6;
    reasons.push(`re_depth_${reCount}`);
  }

  return {
    score: Math.min(100, score),
    reasons,
    followUpOrdinal,
  };
}
