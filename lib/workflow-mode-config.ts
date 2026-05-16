import type { WorkflowMode } from "@/lib/workflow-mode";

export type WorkflowModeBehavior = {
  label: string;
  explanation: string;
  replyCount: number;
  toneBias: number;
  recommendationLabel: string;
  status: string;
  /** Auto-call reply API on open */
  autoGenerateReplies: boolean;
  /** Show reply composer section */
  showReplySection: boolean;
  emphasizeSummary: boolean;
  showArchiveHint: boolean;
  showBulkTriageHint: boolean;
};

export function getWorkflowModeBehavior(mode: WorkflowMode): WorkflowModeBehavior {
  if (mode === "clean") {
    return {
      label: "Clean My Inbox",
      explanation:
        "Demotes newsletters and promotions aggressively. Summaries over replies. Less clutter.",
      replyCount: 0,
      toneBias: -20,
      recommendationLabel: "Quick clear-out",
      status: "Focusing on clearing clutter — replies only when truly needed.",
      autoGenerateReplies: false,
      showReplySection: false,
      emphasizeSummary: true,
      showArchiveHint: true,
      showBulkTriageHint: false,
    };
  }

  if (mode === "handle") {
    return {
      label: "Handle It For Me",
      explanation:
        "Surfaces important human mail first. Hides reply tools on promos. Suggests archive for noise.",
      replyCount: 3,
      toneBias: 8,
      recommendationLabel: "Ready to send",
      status: "Preparing action only where a reply makes sense.",
      autoGenerateReplies: true,
      showReplySection: true,
      emphasizeSummary: true,
      showArchiveHint: true,
      showBulkTriageHint: true,
    };
  }

  return {
    label: "Assist Me",
    explanation:
      "Full reply suggestions when a response makes sense. You choose what to send.",
    replyCount: 3,
    toneBias: 0,
    recommendationLabel: "Recommended",
    status: "Writing reply options when a response is appropriate…",
    autoGenerateReplies: true,
    showReplySection: true,
    emphasizeSummary: false,
    showArchiveHint: false,
    showBulkTriageHint: false,
  };
}
