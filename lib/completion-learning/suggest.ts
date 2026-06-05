import {
  COMPLETION_SUGGESTION_MIN_CONFIDENCE,
  COMPLETION_SUGGESTION_MIN_SAMPLES,
  completionPatternConfidence,
} from "@/lib/completion-learning/confidence";
import { subjectKeywordsForLearning } from "@/lib/completion-learning/pattern";
import type {
  CompletionLearningPattern,
  CompletionLearningStats,
  CompletionPatternScope,
} from "@/lib/completion-learning/types";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { resolveSenderIdentity, type SenderIdentity } from "@/lib/sender-identity";

/** How often the top action wins within a signal group (e.g. 11/12 → 0.92). */
export const COMPLETION_SUGGESTION_MIN_DOMINANCE = 0.75;

const SUGGESTION_SCOPE_ORDER: CompletionPatternScope[] = [
  "sender",
  "category_domain",
  "sender_domain",
  "category_keyword",
  "subject_keyword",
  "category",
];

export type CompletionSuggestion = {
  actionId: CompletionActionId;
  actionLabel: string;
  sampleCount: number;
  similarTotal: number;
  dominance: number;
  confidence: number;
  scope: CompletionPatternScope;
  completionPattern: string;
};

export type CompletionSuggestionInput = {
  sender: string;
  subject: string;
  category: InboxAiCategory;
};

function patternMatchesScope(
  pattern: CompletionLearningPattern,
  scope: CompletionPatternScope,
  identity: SenderIdentity,
  category: InboxAiCategory,
  keywords: Set<string>,
): boolean {
  if (pattern.scope !== scope) return false;

  switch (scope) {
    case "sender":
      return Boolean(pattern.senderRuleKey && pattern.senderRuleKey === identity.ruleKey);
    case "category_domain":
      return (
        pattern.category === category &&
        Boolean(pattern.senderDomain && pattern.senderDomain === identity.domain)
      );
    case "sender_domain":
      return Boolean(pattern.senderDomain && pattern.senderDomain === identity.domain);
    case "category_keyword":
      return (
        pattern.category === category &&
        Boolean(pattern.subjectKeyword && keywords.has(pattern.subjectKeyword))
      );
    case "subject_keyword":
      return Boolean(pattern.subjectKeyword && keywords.has(pattern.subjectKeyword));
    case "category":
      return pattern.category === category;
    default:
      return false;
  }
}

function suggestionFromScopeGroup(
  patterns: CompletionLearningPattern[],
  labelFor: (id: CompletionActionId) => string,
): CompletionSuggestion | null {
  if (!patterns.length) return null;

  const byAction = new Map<CompletionActionId, CompletionLearningPattern>();
  for (const pattern of patterns) {
    const existing = byAction.get(pattern.actionId);
    if (!existing || pattern.sampleCount > existing.sampleCount) {
      byAction.set(pattern.actionId, pattern);
    }
  }

  const ranked = [...byAction.values()].sort(
    (a, b) => b.sampleCount - a.sampleCount || b.confidence - a.confidence,
  );
  const top = ranked[0];
  if (!top) return null;

  const similarTotal = ranked.reduce((sum, p) => sum + p.sampleCount, 0);
  const dominance = similarTotal > 0 ? top.sampleCount / similarTotal : 0;
  const volumeConfidence = completionPatternConfidence(top.sampleCount);
  const confidence = Math.round(dominance * volumeConfidence * 100) / 100;

  const passesVolume = top.sampleCount >= COMPLETION_SUGGESTION_MIN_SAMPLES;
  const passesDominance = dominance >= COMPLETION_SUGGESTION_MIN_DOMINANCE;
  const passesConfidence = confidence >= COMPLETION_SUGGESTION_MIN_CONFIDENCE;
  const passesTotal =
    similarTotal >= COMPLETION_SUGGESTION_MIN_SAMPLES + 1 || top.sampleCount >= 5;

  if (!passesVolume || !passesDominance || !passesConfidence || !passesTotal) {
    return null;
  }

  return {
    actionId: top.actionId,
    actionLabel: labelFor(top.actionId),
    sampleCount: top.sampleCount,
    similarTotal,
    dominance,
    confidence,
    scope: top.scope,
    completionPattern: top.completionPattern,
  };
}

export function suggestCompletionAction(
  stats: CompletionLearningStats,
  input: CompletionSuggestionInput,
  labelFor: (id: CompletionActionId) => string,
): CompletionSuggestion | null {
  if (!stats.patterns.length) return null;

  const identity = resolveSenderIdentity(input.sender);
  const keywords = new Set(subjectKeywordsForLearning(input.subject));

  for (const scope of SUGGESTION_SCOPE_ORDER) {
    const group = stats.patterns.filter((pattern) =>
      patternMatchesScope(pattern, scope, identity, input.category, keywords),
    );
    const suggestion = suggestionFromScopeGroup(group, labelFor);
    if (suggestion) return suggestion;
  }

  return null;
}

export function completionSuggestionExplanation(
  suggestion: CompletionSuggestion,
  locale: "en" | "it",
): string {
  const n = suggestion.sampleCount;
  if (locale === "it") {
    return n === 1
      ? "Basato su 1 email simile."
      : `Basato su ${n} email simili.`;
  }
  return n === 1 ? "Based on 1 similar email." : `Based on ${n} similar emails.`;
}
