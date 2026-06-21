import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { ProactiveSuggestion } from "@/lib/proactive-assistant/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export function scoreProactiveUrgency(input: {
  baseScore: number;
  relationship?: SenderRelationshipProfile | null;
  daysSinceMessage: number;
  escalationScore?: number;
  followUpUrgency?: number;
  category?: InboxAiCategory;
  hasFinancialSignal?: boolean;
  hasSchoolFamilySignal?: boolean;
}): number {
  let score = input.baseScore;

  if (input.relationship?.importance === "vip") score += 18;
  else if (input.relationship?.importance === "important") score += 10;

  if (input.relationship?.kind === "school" || input.relationship?.kind === "family") {
    score += 12;
  }

  if (input.hasSchoolFamilySignal) score += 8;
  if (input.hasFinancialSignal) score += 10;

  if (input.escalationScore) score += Math.min(20, input.escalationScore * 0.2);
  if (input.followUpUrgency) score += Math.min(15, input.followUpUrgency * 0.15);

  if (input.daysSinceMessage >= 5) score += 8;
  if (input.daysSinceMessage >= 3) score += 4;

  if (input.category === "promotions" || input.category === "newsletters") {
    score = Math.min(score, 35);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function sortSuggestions(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
  return [...suggestions].sort((a, b) => b.urgencyScore - a.urgencyScore);
}
