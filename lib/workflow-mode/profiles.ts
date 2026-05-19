import type { WorkflowMode } from "@/lib/workflow-mode";

/** Built-in modes today; extend with custom ids later (founder, parent, etc.). */
export type WorkflowModeId = WorkflowMode;

export type CategorizationAggression = "conservative" | "aggressive" | "proactive";

export type WorkflowModeProfile = {
  id: WorkflowModeId;
  label: string;
  /** Short UI tone line shown in inbox and email detail */
  tagline: string;
  description: string;
  onboarding: string;
  accent: "indigo" | "emerald" | "violet";
  categorizationAggression: CategorizationAggression;
  /** Min rule score (0–1) before demoting mis-tagged human mail to promo/newsletter */
  commercialDemoteThreshold: number;
  hidePromotionsInList: boolean;
  collapseClutterSections: boolean;
  replyCount: number;
  autoGenerateReplies: boolean;
  showReplySection: boolean;
  emphasizeApproval: boolean;
  replyDirective: string;
  toneBias: number;
  brainWeight: "normal" | "high";
  unsubscribeAggressiveness: "low" | "medium" | "high";
  showUnsubscribeOnInbox: boolean;
  inboxHint: string | null;
  recommendationLabel: string;
  statusMessage: string;
  showArchiveHint: boolean;
  showBulkTriageHint: boolean;
  showFollowUpReminders: boolean;
  emphasizeSummary: boolean;
  showDecisionHighlights: boolean;
};

const ASSIST_PROFILE: WorkflowModeProfile = {
  id: "assist",
  label: "Assist Me",
  tagline: "Here's what I recommend.",
  description:
    "Conservative AI: reply suggestions, cautious triage, and clear decisions. You approve every action.",
  onboarding:
    "Handled highlights what matters and suggests replies — nothing happens without your say-so.",
  accent: "indigo",
  categorizationAggression: "conservative",
  commercialDemoteThreshold: 1,
  hidePromotionsInList: false,
  collapseClutterSections: false,
  replyCount: 3,
  autoGenerateReplies: true,
  showReplySection: true,
  emphasizeApproval: true,
  replyDirective:
    "MODE: Assist Me. Be conservative. Offer 3 distinct reply options as recommendations — not commands. Highlight tradeoffs briefly. Never imply anything was sent automatically.",
  toneBias: 0,
  brainWeight: "normal",
  unsubscribeAggressiveness: "low",
  showUnsubscribeOnInbox: false,
  inboxHint: null,
  recommendationLabel: "Recommended",
  statusMessage: "Suggested options — you choose what to send.",
  showArchiveHint: false,
  showBulkTriageHint: false,
  showFollowUpReminders: true,
  emphasizeSummary: false,
  showDecisionHighlights: true,
};

const CLEAN_PROFILE: WorkflowModeProfile = {
  id: "clean",
  label: "Clean My Inbox",
  tagline: "I cleaned this up for you.",
  description:
    "Aggressively demotes newsletters and promotions, groups clutter, and prioritizes urgent mail. Summaries over replies.",
  onboarding:
    "Handled sweeps promotional noise aside so you see what needs you — unsubscribe suggestions appear often.",
  accent: "emerald",
  categorizationAggression: "aggressive",
  commercialDemoteThreshold: 0.22,
  hidePromotionsInList: false,
  collapseClutterSections: true,
  replyCount: 0,
  autoGenerateReplies: false,
  showReplySection: false,
  emphasizeApproval: false,
  replyDirective:
    "MODE: Clean My Inbox. Do NOT draft replies unless a human clearly expects a response. Prefer suggesting archive/skim actions.",
  toneBias: -25,
  brainWeight: "normal",
  unsubscribeAggressiveness: "high",
  showUnsubscribeOnInbox: true,
  inboxHint:
    "Clean mode: clutter is grouped below. Newsletters and promotions are demoted — focus on what needs you.",
  recommendationLabel: "Optional reply",
  statusMessage: "Inbox simplified — replies only when truly needed.",
  showArchiveHint: true,
  showBulkTriageHint: true,
  showFollowUpReminders: true,
  emphasizeSummary: true,
  showDecisionHighlights: false,
};

const HANDLE_PROFILE: WorkflowModeProfile = {
  id: "handle",
  label: "Handle It For Me",
  tagline: "This is already prepared.",
  description:
    "Proactive assistant: full reply drafts, stronger Brain usage, follow-up hints. Promotions hidden from the list.",
  onboarding:
    "Handled prepares send-ready drafts and surfaces only important threads. You still approve every send.",
  accent: "violet",
  categorizationAggression: "proactive",
  commercialDemoteThreshold: 0.45,
  hidePromotionsInList: true,
  collapseClutterSections: false,
  replyCount: 3,
  autoGenerateReplies: true,
  showReplySection: true,
  emphasizeApproval: true,
  replyDirective:
    "MODE: Handle It For Me. Draft complete, send-ready replies (still user-approved). Be decisive, specific, and action-oriented. Use Handled Brain facts when relevant. Suggest clear next steps.",
  toneBias: 12,
  brainWeight: "high",
  unsubscribeAggressiveness: "medium",
  showUnsubscribeOnInbox: false,
  inboxHint:
    "Handle mode: only important mail is shown here. Drafts are prepared — you approve before anything sends.",
  recommendationLabel: "Ready to send",
  statusMessage: "Prepared for your review — approve before sending.",
  showArchiveHint: true,
  showBulkTriageHint: true,
  showFollowUpReminders: true,
  emphasizeSummary: true,
  showDecisionHighlights: false,
};

export const WORKFLOW_MODE_PROFILES: Record<WorkflowModeId, WorkflowModeProfile> = {
  assist: ASSIST_PROFILE,
  clean: CLEAN_PROFILE,
  handle: HANDLE_PROFILE,
};

/** Future custom modes — register here when implemented */
export const FUTURE_WORKFLOW_MODE_IDS = [
  "founder",
  "parent",
  "adhd",
  "sales",
  "executive_assistant",
] as const;

export type FutureWorkflowModeId = (typeof FUTURE_WORKFLOW_MODE_IDS)[number];

export function getWorkflowModeProfile(mode: WorkflowMode): WorkflowModeProfile {
  return WORKFLOW_MODE_PROFILES[mode] ?? ASSIST_PROFILE;
}

