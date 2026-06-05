import { trackEvent } from "@/lib/analytics";
import type { CompletionLearningPattern } from "@/lib/completion-learning/types";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

export function trackCompletionLearningRecorded(
  record: EmailCompletionRecord,
  updatedPatterns: CompletionLearningPattern[],
): void {
  const senderRuleKey = resolveSenderIdentity(record.sender).ruleKey || null;
  trackEvent("completion_learning_recorded", {
    action_id: record.actionId,
    category: record.category,
    sender_domain: record.senderDomain ?? null,
    sender_rule_key: senderRuleKey,
  });

  for (const pattern of updatedPatterns) {
    trackEvent("completion_pattern_updated", {
      completion_pattern: pattern.completionPattern,
      scope: pattern.scope,
      sample_count: pattern.sampleCount,
      confidence: pattern.confidence,
      action_id: pattern.actionId,
      category: pattern.category ?? null,
      sender_domain: pattern.senderDomain ?? null,
      subject_keyword: pattern.subjectKeyword ?? null,
    });
  }
}
