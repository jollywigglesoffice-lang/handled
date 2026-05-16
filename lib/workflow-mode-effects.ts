import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";
import {
  commercialLeanCategory,
  computeInboxRuleScores,
  looksLikeHumanConversation,
} from "@/lib/inbox-rule-classify";
import { hasUrgentHumanSignal, isCommercialBulk } from "@/lib/inbox-triage-signals";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";

export { WORKFLOW_MODE_HEADER };

export { parseWorkflowMode as parseWorkflowModeHeader } from "@/lib/workflow-mode";

/**
 * Mode-specific triage after rules/AI. Never auto-sends or archives — only category labels.
 */
export function applyWorkflowModeToCategory(
  mode: WorkflowMode,
  row: GmailInboxRow,
  category: InboxAiCategory,
  source: CategorySource,
): { category: InboxAiCategory; source: CategorySource } {
  if (mode === "assist") {
    return { category, source };
  }

  const scores = computeInboxRuleScores(row);
  const subject = (row.subject ?? "").toLowerCase();
  const snippet = (row.snippet ?? "").toLowerCase();
  const combined = `${subject} ${snippet}`;

  if (mode === "clean") {
    if (category === "needs_attention" || category === "quick_reply") {
      if (scores.promotion >= 0.5 || scores.newsletter >= 0.5 || isCommercialBulk(row)) {
        const lean = commercialLeanCategory(row);
        if (lean) {
          return { category: lean, source: "heuristic" };
        }
        return { category: "promotion", source: "heuristic" };
      }
      if (
        combined.includes("unsubscribe") ||
        combined.includes("newsletter") ||
        combined.includes("digest") ||
        combined.includes("promo") ||
        combined.includes("% off") ||
        combined.includes("sale")
      ) {
        return {
          category: scores.newsletter >= scores.promotion ? "newsletter" : "promotion",
          source: "heuristic",
        };
      }
    }
    if (category === "quick_reply" && !looksLikeHumanConversation(row)) {
      const lean = commercialLeanCategory(row);
      if (lean) {
        return { category: lean, source: "heuristic" };
      }
    }
    return { category, source };
  }

  if (mode === "handle") {
    if (
      category === "needs_attention" &&
      (scores.promotion >= 1 || scores.newsletter >= 1 || isCommercialBulk(row)) &&
      !hasUrgentHumanSignal(row)
    ) {
      const lean = commercialLeanCategory(row);
      return {
        category: lean ?? "promotion",
        source: "heuristic",
      };
    }
    if (
      category === "needs_attention" &&
      looksLikeHumanConversation(row) &&
      scores.promotion < 1 &&
      scores.newsletter < 1
    ) {
      return { category: "needs_attention", source };
    }
    if (category === "promotion" || category === "newsletter") {
      return { category, source };
    }
  }

  return { category, source };
}

export function workflowModeReplyDirective(mode: WorkflowMode): string {
  if (mode === "clean") {
    return "User mode: Clean My Inbox. Only draft replies if a human clearly expects a response.";
  }
  if (mode === "handle") {
    return "User mode: Handle It For Me. Draft a complete, send-ready reply only when appropriate. Be decisive.";
  }
  return "User mode: Assist Me. Helpful reply options when a human expects a response.";
}
