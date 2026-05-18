import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile, type WorkflowModeProfile } from "@/lib/workflow-mode/profiles";

function profileToLegacyBehavior(profile: WorkflowModeProfile): WorkflowModeBehavior {
  return {
    label: profile.label,
    explanation: profile.description,
    replyCount: profile.replyCount,
    toneBias: profile.toneBias,
    recommendationLabel: profile.recommendationLabel,
    status: profile.statusMessage,
    autoGenerateReplies: profile.autoGenerateReplies,
    showReplySection: profile.showReplySection,
    emphasizeSummary: profile.emphasizeSummary,
    showArchiveHint: profile.showArchiveHint,
    showBulkTriageHint: profile.showBulkTriageHint,
    tagline: profile.tagline,
    emphasizeApproval: profile.emphasizeApproval,
    showFollowUpReminders: profile.showFollowUpReminders,
    showDecisionHighlights: profile.showDecisionHighlights,
  };
}

export type WorkflowModeBehavior = {
  label: string;
  explanation: string;
  replyCount: number;
  toneBias: number;
  recommendationLabel: string;
  status: string;
  autoGenerateReplies: boolean;
  showReplySection: boolean;
  emphasizeSummary: boolean;
  showArchiveHint: boolean;
  showBulkTriageHint: boolean;
  tagline: string;
  emphasizeApproval: boolean;
  showFollowUpReminders: boolean;
  showDecisionHighlights: boolean;
};

export function getWorkflowModeBehavior(mode: WorkflowMode): WorkflowModeBehavior {
  return profileToLegacyBehavior(getWorkflowModeProfile(mode));
}
