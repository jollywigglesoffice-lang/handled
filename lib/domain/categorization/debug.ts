import { isCategoryDebugEnabled } from "@/lib/domain/categorization/debug-flag";
import type { CategoryResolutionAudit } from "@/lib/domain/categorization/final-resolution";

export { isCategoryDebugEnabled } from "@/lib/domain/categorization/debug-flag";

export function logCategoryResolutionDebug(audit: CategoryResolutionAudit): void {
  if (!isCategoryDebugEnabled()) return;

  const scope = audit.accountId ? `${audit.accountId}:${audit.emailId}` : audit.emailId;
  console.log("[category-debug]", {
    emailId: audit.emailId,
    accountId: audit.accountId,
    subjectScope: scope,
    input: {
      dbCategory: audit.dbCategory,
      aiCategory: audit.aiCategory,
      manualOverride: audit.manualOverride,
      memoryLearned: audit.memoryLearned,
      correctionHistory: audit.correctionHistory,
      senderLearned: audit.senderLearned,
      senderRuleLabel: audit.senderRuleLabel,
      persistedCategory: audit.persistedCategory,
    },
    resolvedCategory: audit.finalCategory,
    ruleSource: audit.winningRule,
    categorySource: audit.finalSource,
    senderRuleApplied: audit.senderLearned,
    finalCategoryDecisionSource: audit.winningRule,
    overrideReason: audit.overrideReason,
  });
}
