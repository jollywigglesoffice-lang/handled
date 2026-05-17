import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { WorkflowMode } from "@/lib/workflow-mode";

export type InboxListMessage = {
  category: InboxAiCategory;
};

/** Whether to show this message in the inbox list for the active workflow mode. */
export function shouldShowMessageInWorkflow<T extends InboxListMessage>(
  message: T,
  mode: WorkflowMode,
): boolean {
  if (mode === "assist") return true;
  if (mode === "clean") return true;
  if (mode === "handle") {
    return (
      message.category === "needs_attention" ||
      message.category === "quick_reply" ||
      message.category === "handled"
    );
  }
  return true;
}

export function workflowModeInboxHint(mode: WorkflowMode): string | null {
  if (mode === "clean") {
    return "Clean mode: clutter is demoted. Summaries over replies on each email.";
  }
  if (mode === "handle") {
    return "Handle mode: promotions and newsletters are hidden here — only important mail shown.";
  }
  return null;
}

export const GMAIL_CATEGORY_ORDER_BY_MODE: Record<WorkflowMode, InboxAiCategory[]> = {
  assist: ["needs_attention", "quick_reply", "handled", "newsletter", "promotion"],
  clean: ["needs_attention", "quick_reply", "handled", "newsletter", "promotion"],
  handle: ["needs_attention", "quick_reply", "handled"],
};
