import type { InboxStressInput } from "@/lib/inbox-stress/types";

/** Raw stress score 0–100 from current signals. Soft — never binary. */
export function computeStressScore(input: InboxStressInput): number {
  let score = 0;

  if (input.needsAttention >= 25) score += 35;
  else if (input.needsAttention >= 12) score += 22;
  else if (input.unreadCount >= 40) score += 18;

  if (input.urgentCount >= 4) score += 25;
  else if (input.urgentCount >= 2) score += 15;

  if (input.sessionSkips >= 4) score += 28;
  else if (input.sessionSkips >= 2) score += 16;

  if (input.sessionQuickDones >= 3) score += 22;
  else if (input.sessionQuickDones >= 2) score += 12;

  if (input.rapidNavCount >= 3) score += 22;
  else if (input.rapidNavCount >= 2) score += 14;

  if (input.onboardingHesitation) score += 12;
  if (input.emotionalNeedsSpace) score += 10;

  if (
    input.totalVisible >= 50 &&
    input.needsAttention >= 8 &&
    input.sessionSkips + input.sessionQuickDones >= 2
  ) {
    score += 12;
  }

  return Math.min(100, score);
}
