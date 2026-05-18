import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

export type InboxListMessage = {
  category: InboxAiCategory;
};

const CLUTTER_CATEGORIES: InboxAiCategory[] = ["newsletter", "promotion"];

/** Whether to show this message in the main inbox list for the active workflow mode. */
export function shouldShowMessageInWorkflow<T extends InboxListMessage>(
  message: T,
  mode: WorkflowMode,
): boolean {
  const profile = getWorkflowModeProfile(mode);
  if (profile.hidePromotionsInList) {
    return !CLUTTER_CATEGORIES.includes(message.category);
  }
  return true;
}

export function workflowModeInboxHint(mode: WorkflowMode): string | null {
  return getWorkflowModeProfile(mode).inboxHint;
}

export function workflowModeTagline(mode: WorkflowMode): string {
  return getWorkflowModeProfile(mode).tagline;
}

/** Section order for non-clutter categories */
export function primaryCategoryOrderForMode(mode: WorkflowMode): InboxAiCategory[] {
  const profile = getWorkflowModeProfile(mode);
  if (profile.collapseClutterSections || profile.hidePromotionsInList) {
    return ["needs_attention", "quick_reply", "handled"];
  }
  return ["needs_attention", "quick_reply", "handled", "newsletter", "promotion"];
}

export const GMAIL_CATEGORY_ORDER_BY_MODE: Record<WorkflowMode, InboxAiCategory[]> = {
  assist: ["needs_attention", "quick_reply", "handled", "newsletter", "promotion"],
  clean: ["needs_attention", "quick_reply", "handled", "newsletter", "promotion"],
  handle: ["needs_attention", "quick_reply", "handled"],
};

export function isClutterCategory(category: InboxAiCategory): boolean {
  return CLUTTER_CATEGORIES.includes(category);
}

export function shouldCollapseClutter(mode: WorkflowMode): boolean {
  return getWorkflowModeProfile(mode).collapseClutterSections;
}
