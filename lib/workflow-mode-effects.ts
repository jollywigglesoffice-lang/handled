import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";
import {
  commercialLeanCategory,
  computeInboxRuleScores,
  looksLikeHumanConversation,
} from "@/lib/inbox-rule-classify";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";

export { WORKFLOW_MODE_HEADER };

export function parseWorkflowModeHeader(value: string | null | undefined): WorkflowMode {
  const v = value?.trim().toLowerCase();
  if (v === "clean" || v === "handle") return v;
  return "assist";
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
  if (mode === "assist") {
    return { category, source };
  }

  const scores = computeInboxRuleScores(row);
  const subject = (row.subject ?? "").toLowerCase();
  const snippet = (row.snippet ?? "").toLowerCase();
  const combined = `${subject} ${snippet}`;

  if (mode === "clean") {
    if (category === "needs_attention") {
      if (scores.promotion >= 1 || scores.newsletter >= 1) {
        const lean = commercialLeanCategory(row);
        if (lean) {
          return { category: lean, source: "heuristic" };
        }
      }
      if (
        combined.includes("unsubscribe") ||
        combined.includes("newsletter") ||
        combined.includes("digest") ||
        combined.includes("promo") ||
        combined.includes("% off")
      ) {
        return {
          category: scores.newsletter >= scores.promotion ? "newsletter" : "promotion",
          source: "heuristic",
        };
      }
    }
    if (category === "quick_reply" && !looksLikeHumanConversation(row)) {
      const lean = commercialLeanCategory(row);
      if (lean && (scores.promotion >= 1 || scores.newsletter >= 1)) {
        return { category: lean, source: "heuristic" };
      }
    }
    return { category, source };
  }

  // handle — favor fast triage: human threads → quick_reply when not urgent
  if (mode === "handle") {
    if (
      category === "needs_attention" &&
      looksLikeHumanConversation(row) &&
      scores.promotion < 1 &&
      scores.newsletter < 1
    ) {
      const short =
        (row.snippet?.length ?? 0) < 280 ||
        /\?|please|asap|urgent|deadline|today|tomorrow/i.test(combined);
      if (short) {
        return { category: "quick_reply", source: source === "ai" ? "ai" : "heuristic" };
      }
    }
  }

  return { category, source };
}

export function workflowModeReplyDirective(mode: WorkflowMode): string {
  if (mode === "clean") {
    return "User mode: Clean My Inbox. Prefer the shortest reply that clears this thread. Do not suggest follow-ups unless required.";
  }
  if (mode === "handle") {
    return "User mode: Handle It For Me. First reply should be a complete, send-ready draft with a clear next step. User still approves before sending.";
  }
  return "User mode: Assist Me. Offer helpful reply options only; do not assume the user wants to close the thread.";
}
