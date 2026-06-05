import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { resolveSenderIdentity } from "@/lib/sender-identity";
import type {
  CompletionLearningPattern,
  CompletionLearningStats,
  CompletionPatternScope,
} from "@/lib/completion-learning/types";

export type CompletionPatternSignal = {
  scope: CompletionPatternScope;
  actionId: CompletionActionId;
  category?: InboxAiCategory;
  senderDomain?: string;
  senderRuleKey?: string;
  subjectKeyword?: string;
};

export function formatCompletionPattern(signal: CompletionPatternSignal): string {
  const parts: string[] = [];
  if (signal.senderRuleKey) parts.push(`sender:${signal.senderRuleKey}`);
  else if (signal.senderDomain) parts.push(`domain:${signal.senderDomain}`);
  if (signal.category) parts.push(`category:${signal.category}`);
  if (signal.subjectKeyword) parts.push(`keyword:${signal.subjectKeyword}`);
  if (parts.length === 0) parts.push("global");
  return `${parts.join("+")}→${signal.actionId}`;
}

export function patternSignalKey(signal: CompletionPatternSignal): string {
  return [
    signal.scope,
    signal.actionId,
    signal.category ?? "",
    signal.senderDomain ?? "",
    signal.senderRuleKey ?? "",
    signal.subjectKeyword ?? "",
  ].join("|");
}

export function patternRowKey(pattern: CompletionLearningPattern): string {
  return patternSignalKey({
    scope: pattern.scope,
    actionId: pattern.actionId,
    category: pattern.category,
    senderDomain: pattern.senderDomain,
    senderRuleKey: pattern.senderRuleKey,
    subjectKeyword: pattern.subjectKeyword,
  });
}

/** Future copy hook — not shown in UI yet. */
export function completionPatternSuggestionHint(
  pattern: CompletionLearningPattern,
  actionLabel: string,
  locale: "en" | "it" = "en",
): string {
  if (locale === "it") {
    if (pattern.senderRuleKey) {
      return `Le email da questo mittente di solito finiscono come: ${actionLabel}.`;
    }
    if (pattern.subjectKeyword) {
      return `Le email con “${pattern.subjectKeyword}” di solito finiscono come: ${actionLabel}.`;
    }
    if (pattern.senderDomain) {
      return `Le email da ${pattern.senderDomain} di solito finiscono come: ${actionLabel}.`;
    }
    return `Email come questa di solito finiscono come: ${actionLabel}.`;
  }

  if (pattern.senderRuleKey) {
    return `Emails from this sender are usually marked: ${actionLabel}.`;
  }
  if (pattern.subjectKeyword) {
    return `Emails mentioning “${pattern.subjectKeyword}” are usually marked: ${actionLabel}.`;
  }
  if (pattern.senderDomain) {
    return `Emails from ${pattern.senderDomain} are usually marked: ${actionLabel}.`;
  }
  return `Emails like this are usually marked: ${actionLabel}.`;
}

export function subjectKeywordsForLearning(subject: string): string[] {
  const cleaned = subject
    .replace(/^(re|fwd?):\s*/gi, "")
    .replace(/[^\w\s]/g, " ")
    .trim();
  return cleaned
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^\d+$/.test(w))
    .slice(0, 2)
    .map((w) => w.toLowerCase());
}

export function matchPatternsForEmail(
  stats: CompletionLearningStats,
  input: { sender: string; category: InboxAiCategory; subject: string },
): CompletionLearningPattern[] {
  const identity = resolveSenderIdentity(input.sender);
  const keywords = new Set(subjectKeywordsForLearning(input.subject));

  return stats.patterns
    .filter((pattern) => {
      if (pattern.category && pattern.category !== input.category) return false;
      if (pattern.senderDomain && pattern.senderDomain !== identity.domain) return false;
      if (pattern.senderRuleKey && pattern.senderRuleKey !== identity.ruleKey) return false;
      if (pattern.subjectKeyword && !keywords.has(pattern.subjectKeyword)) return false;
      return true;
    })
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.sampleCount - a.sampleCount ||
        b.lastUsedAt - a.lastUsedAt,
    );
}

export function topCompletionPatterns(
  stats: CompletionLearningStats,
  options?: { minConfidence?: number; minSamples?: number; limit?: number },
): CompletionLearningPattern[] {
  const minConfidence = options?.minConfidence ?? 0;
  const minSamples = options?.minSamples ?? 1;
  const limit = options?.limit ?? 20;

  return stats.patterns
    .filter((p) => p.sampleCount >= minSamples && p.confidence >= minConfidence)
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.sampleCount - a.sampleCount ||
        b.lastUsedAt - a.lastUsedAt,
    )
    .slice(0, limit);
}
