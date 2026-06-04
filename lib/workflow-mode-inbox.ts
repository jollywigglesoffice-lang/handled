import {
  EMPTY_CATEGORY_CATALOG,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import {
  GMAIL_INBOX_SECTION_ORDER,
  INBOX_CATEGORY_PRIMARY_ORDER,
  INBOX_CLUTTER_CATEGORIES,
  isSystemInboxCategory,
  type InboxAiCategory,
} from "@/lib/inbox-ai-categories";
import { shouldHideForRelationship } from "@/lib/relationship-intelligence/effects";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

export type InboxListMessage = {
  category: InboxAiCategory;
  relationship?: SenderRelationshipProfile;
};

export { GMAIL_INBOX_SECTION_ORDER };

export const GMAIL_CATEGORY_ORDER_BY_MODE: Record<WorkflowMode, InboxAiCategory[]> = {
  assist: GMAIL_INBOX_SECTION_ORDER,
  clean: GMAIL_INBOX_SECTION_ORDER,
  handle: INBOX_CATEGORY_PRIMARY_ORDER,
};

export function gmailCategoryOrderForMode(
  mode: WorkflowMode,
  catalog: InboxCategoryCatalog,
): InboxAiCategory[] {
  if (mode === "handle") return catalog.primaryOrder;
  return catalog.sectionOrder;
}

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
    return !INBOX_CLUTTER_CATEGORIES.includes(message.category);
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
export function primaryCategoryOrderForMode(
  mode: WorkflowMode,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): InboxAiCategory[] {
  const profile = getWorkflowModeProfile(mode);
  if (profile.collapseClutterSections || profile.hidePromotionsInList) {
    return catalog.primaryOrder;
  }
  return catalog.sectionOrder;
}

export function isClutterCategory(category: InboxAiCategory): boolean {
  if (isSystemInboxCategory(category)) {
    return INBOX_CLUTTER_CATEGORIES.includes(category);
  }
  return false;
}

export function shouldCollapseClutter(mode: WorkflowMode): boolean {
  return getWorkflowModeProfile(mode).collapseClutterSections;
}
