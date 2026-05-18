import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";
import {
  commercialLeanCategory,
  computeInboxRuleScores,
  looksLikeHumanConversation,
} from "@/lib/inbox-rule-classify";
import { hasHighPriorityIntent } from "@/lib/email-intent";
import { hasUrgentHumanSignal, isCommercialBulk } from "@/lib/inbox-triage-signals";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

export { WORKFLOW_MODE_HEADER };
export { parseWorkflowMode as parseWorkflowModeHeader } from "@/lib/workflow-mode";

function demoteCommercial(
  row: GmailInboxRow,
  scores: ReturnType<typeof computeInboxRuleScores>,
  threshold: number,
): InboxAiCategory | null {
  if (scores.promotion >= threshold || scores.newsletter >= threshold || isCommercialBulk(row)) {
    const lean = commercialLeanCategory(row);
    return lean ?? (scores.newsletter >= scores.promotion ? "newsletter" : "promotion");
  }
  const combined = `${row.subject ?? ""} ${row.snippet ?? ""}`.toLowerCase();
  if (
    /\b(unsubscribe|newsletter|digest|promo|% off|sale|marketing)\b/i.test(combined)
  ) {
    return scores.newsletter >= scores.promotion ? "newsletter" : "promotion";
  }
  return null;
}

/**
 * Mode-specific triage after rules/AI. Never auto-sends or archives — only category labels.
 */
export function applyWorkflowModeToCategory(
  mode: WorkflowMode,
  row: GmailInboxRow,
  category: InboxAiCategory,
  source: CategorySource,
): { category: InboxAiCategory; source: CategorySource } {
  if (hasHighPriorityIntent(row)) {
    return { category, source };
  }

  const profile = getWorkflowModeProfile(mode);

  if (profile.categorizationAggression === "conservative") {
    return { category, source };
  }

  const scores = computeInboxRuleScores(row);
  const threshold = profile.commercialDemoteThreshold;

  if (profile.categorizationAggression === "aggressive") {
    if (category === "needs_attention" || category === "quick_reply") {
      const demoted = demoteCommercial(row, scores, threshold);
      if (demoted) {
        return { category: demoted, source: "heuristic" };
      }
    }
    if (category === "quick_reply" && !looksLikeHumanConversation(row)) {
      const lean = commercialLeanCategory(row);
      if (lean) return { category: lean, source: "heuristic" };
    }
    return { category, source };
  }

  if (profile.categorizationAggression === "proactive") {
    if (
      (category === "needs_attention" || category === "quick_reply") &&
      (scores.promotion >= threshold ||
        scores.newsletter >= threshold ||
        isCommercialBulk(row)) &&
      !hasUrgentHumanSignal(row)
    ) {
      const lean = commercialLeanCategory(row);
      return { category: lean ?? "promotion", source: "heuristic" };
    }
    if (
      category === "needs_attention" &&
      looksLikeHumanConversation(row) &&
      scores.promotion < 1 &&
      scores.newsletter < 1
    ) {
      return { category: "needs_attention", source };
    }
  }

  return { category, source };
}

export function workflowModeReplyDirective(mode: WorkflowMode): string {
  return getWorkflowModeProfile(mode).replyDirective;
}

/** Brain retrieval cap scales with mode */
export function workflowModeBrainMaxChunks(mode: WorkflowMode): number {
  return getWorkflowModeProfile(mode).brainWeight === "high" ? 10 : 6;
}
