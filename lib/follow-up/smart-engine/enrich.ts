import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { ConversationState, FollowUpAnalysis } from "@/lib/follow-up/types";
import {
  detectStalledSignals,
  isLikelyClosedConversation,
} from "@/lib/follow-up/smart-engine/detect-stalled";
import { suggestFollowUpTiming } from "@/lib/follow-up/smart-engine/timing";
import type {
  FollowUpDisplayState,
  SmartFollowUpEnrichment,
  StalledConversationSignals,
} from "@/lib/follow-up/smart-engine/types";

function displayStateFromConversation(
  state: ConversationState,
  signals: StalledConversationSignals,
): FollowUpDisplayState {
  if (signals.pendingPayment) return "pending_payment";
  if (signals.pendingApproval || state === "awaiting_approval") return "awaiting_approval";
  if (state === "awaiting_your_reply") return "awaiting_your_reply";
  if (state === "pending_scheduling") return "pending_scheduling";
  if (state === "user_commitment_pending") return "your_commitment";
  if (state === "waiting_for_response") return "waiting_on_reply";
  if (state === "follow_up_recommended") return "follow_up_suggested";
  return "follow_up_suggested";
}
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export function enrichWithSmartFollowUp(input: {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  analysis: FollowUpAnalysis;
  relationship?: SenderRelationshipProfile | null;
  locale?: "en" | "it";
}): SmartFollowUpEnrichment & Partial<FollowUpAnalysis> {
  const hay = `${input.row.sender} ${input.row.subject} ${input.row.snippet ?? ""}`;
  const signals = detectStalledSignals(input.row, input.analysis.category);
  const days = input.analysis.daysSinceMessage;

  if (isLikelyClosedConversation(hay, input.analysis.category, days)) {
    return {
      displayState: "closed_conversation",
      timing: {
        message:
          input.locale === "it"
            ? "Conversazione probabilmente conclusa."
            : "This conversation is likely complete.",
        suggestedInDays: 0,
        tone: "gentle",
      },
      atRiskOfForgotten: false,
      recentlyActive: false,
      signals,
    };
  }

  const recentlyActive =
    days < 2 &&
    (input.analysis.state === "waiting_for_response" ||
      input.analysis.state === "conversation_unresolved");

  const displayState = recentlyActive
    ? "recently_active"
    : displayStateFromConversation(input.analysis.state, signals);

  const timing = suggestFollowUpTiming({
    state: input.analysis.state,
    daysSinceMessage: days,
    urgencyScore: input.analysis.urgencyScore,
    signals,
    relationship: input.relationship,
    locale: input.locale,
  });

  const atRiskOfForgotten =
    !recentlyActive &&
    days >= 3 &&
    input.analysis.urgencyScore >= 50 &&
    (input.analysis.state === "waiting_for_response" ||
      input.analysis.state === "follow_up_recommended" ||
      signals.businessOpportunityStalled ||
      signals.promisedInformationMissing);

  return {
    displayState,
    timing,
    atRiskOfForgotten,
    recentlyActive,
    signals,
    suggestedFollowUpDays: timing.suggestedInDays || input.analysis.suggestedFollowUpDays,
  };
}

/** Skip surfacing very fresh low-urgency threads in the follow-up section. */
export function shouldSurfaceInFollowUpSection(
  enrichment: SmartFollowUpEnrichment,
  urgencyScore: number,
): boolean {
  if (enrichment.displayState === "closed_conversation") return false;
  if (enrichment.recentlyActive && urgencyScore < 55) return false;
  return true;
}

export function resolveStateWithSmartSignals(
  baseState: ConversationState | null,
  signals: ReturnType<typeof detectStalledSignals>,
): ConversationState | null {
  if (!baseState) return null;
  if (signals.pendingApproval) return "awaiting_approval";
  if (signals.pendingPayment) return "pending_payment";
  if (signals.userSentNoReplyHeuristic && baseState === "conversation_unresolved") {
    return "waiting_for_response";
  }
  if (signals.promisedInformationMissing && baseState === "conversation_unresolved") {
    return "follow_up_recommended";
  }
  return baseState;
}
