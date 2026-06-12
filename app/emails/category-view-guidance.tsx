"use client";

import { inboxCategoryTabGuidance } from "@/lib/inbox-ai-categories";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { isClutterCategory } from "@/lib/workflow-mode-inbox";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

type CategoryViewGuidanceProps = {
  category: InboxAiCategory;
  locale: "en" | "it";
  workflowMode: WorkflowMode;
  count: number;
};

/**
 * Reassurance banner on dedicated category tabs — especially Promotions and
 * Newsletters, which may be hidden from the main workflow view.
 */
export function CategoryViewGuidance({
  category,
  locale,
  workflowMode,
  count,
}: CategoryViewGuidanceProps) {
  if (count === 0) return null;

  const profile = getWorkflowModeProfile(workflowMode);
  const isClutter = isClutterCategory(category);
  const hiddenFromWorkflow =
    profile.hidePromotionsInList || (profile.collapseClutterSections && isClutter);

  const copy = inboxCategoryTabGuidance(category, locale);
  if (!copy && !hiddenFromWorkflow) return null;

  const message =
    copy ??
    (locale === "it"
      ? "Queste email sono fuori dal flusso principale, ma restano sempre accessibili qui."
      : "These emails are outside your main workflow, but they're always accessible here.");

  return (
    <p className="rounded-xl border border-amber-100/80 bg-amber-50/40 px-4 py-3 text-sm leading-relaxed text-amber-950/80">
      {message}
    </p>
  );
}
