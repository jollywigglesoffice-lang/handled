import type { UnsubscribeAnalysis } from "@/lib/unsubscribe/types";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

/** Whether to surface unsubscribe intelligence for this message in the current mode. */
export function shouldShowUnsubscribeIntelligence(
  mode: WorkflowMode,
  analysis: Pick<UnsubscribeAnalysis, "isNewsletterLike" | "methods">,
  inboxCategory?: string,
): boolean {
  const profile = getWorkflowModeProfile(mode);
  const isClutter =
    inboxCategory === "newsletter" ||
    inboxCategory === "promotion" ||
    analysis.isNewsletterLike;

  if (profile.unsubscribeAggressiveness === "high") {
    return isClutter || analysis.methods.length > 0;
  }
  if (profile.unsubscribeAggressiveness === "medium") {
    return isClutter && analysis.methods.length > 0;
  }
  return analysis.methods.length > 0 && isClutter;
}

export function shouldShowUnsubscribeInboxBadge(
  mode: WorkflowMode,
  hasSignal: boolean,
  category: string,
): boolean {
  const profile = getWorkflowModeProfile(mode);
  if (!profile.showUnsubscribeOnInbox) return false;
  if (category === "newsletter" || category === "promotion") return true;
  return hasSignal && profile.unsubscribeAggressiveness === "high";
}
