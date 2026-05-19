import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { shouldHideForRelationship } from "@/lib/relationship-intelligence/effects";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

export type InboxListMessage = {
  category: InboxAiCategory;
  relationship?: SenderRelationshipProfile;
};

const CLUTTER_CATEGORIES: InboxAiCategory[] = ["newsletter", "promotion"];

/** Whether to show this message in the main inbox list for the active workflow mode. */
export function shouldShowMessageInWorkflow<T extends InboxListMessage>(
  message: T,
  mode: WorkflowMode,
): boolean {
  if (
    message.relationship &&
    shouldHideForRelationship(message.relationship, message.category, mode)
  ) {
    return false;
  }
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
