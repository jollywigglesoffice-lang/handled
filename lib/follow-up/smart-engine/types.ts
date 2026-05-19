/** Calm user-facing follow-up states (UI labels). */
export type FollowUpDisplayState =
  | "waiting_on_reply"
  | "follow_up_suggested"
  | "recently_active"
  | "closed_conversation"
  | "awaiting_approval"
  | "awaiting_your_reply"
  | "pending_scheduling"
  | "your_commitment"
  | "pending_payment";

export type FollowUpTimingTone = "gentle" | "normal" | "consider_escalation";

export type FollowUpTimingSuggestion = {
  message: string;
  suggestedInDays: number;
  tone: FollowUpTimingTone;
};

export type StalledConversationSignals = {
  waitingOnTheirReply: boolean;
  promisedInformationMissing: boolean;
  pendingConfirmation: boolean;
  pendingApproval: boolean;
  pendingPayment: boolean;
  userSentNoReplyHeuristic: boolean;
  businessOpportunityStalled: boolean;
};

export type SmartFollowUpEnrichment = {
  displayState: FollowUpDisplayState;
  timing: FollowUpTimingSuggestion;
  atRiskOfForgotten: boolean;
  recentlyActive: boolean;
  signals: StalledConversationSignals;
};

export type SmartFollowUpDraftTone = {
  style: string;
  openerExamples: string[];
};

