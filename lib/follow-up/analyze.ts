import { hasSchedulingIntent } from "@/lib/calendar-awareness";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { analyzeEmailIntent } from "@/lib/email-intent";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { senderFirstNameFromRow } from "@/lib/follow-up/format";
import {
  relationshipFollowUpHeadline,
  relationshipUrgencyBoost,
} from "@/lib/relationship-intelligence/effects";
import { resolveSenderRelationship } from "@/lib/relationship-intelligence/resolve";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import { scoreFollowUpUrgency } from "@/lib/follow-up/urgency";
import {
  detectStalledSignals,
  enrichWithSmartFollowUp,
  resolveStateWithSmartSignals,
  shouldSurfaceInFollowUpSection,
} from "@/lib/follow-up/smart-engine";
import { headlinesForFollowUpState } from "@/lib/continuity-context";
import { analyzeTimelineIntelligence } from "@/lib/timeline-intelligence";
import { toThreadSnapshot } from "@/lib/timeline-intelligence/thread-group";
import type { ConversationState, FollowUpAnalysis } from "@/lib/follow-up/types";

function haystack(row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">): string {
  return `${row.sender} ${row.subject} ${row.snippet ?? ""}`;
}

function daysSince(internalDateMs: number): number {
  if (!internalDateMs) return 0;
  const diff = Date.now() - internalDateMs;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

const AWAITING_YOU =
  /please (?:confirm|let me know|send|review|approve)|can you|could you|would you mind|waiting (?:for|on) your|need your (?:reply|response|input|approval)|action required/i;

const WAITING_ON_THEM =
  /following up|follow(?:-| )?up on|checking in|any update|haven'?t heard|have not heard|still waiting|just wanted to (?:check|see)|gentle reminder|bumping this/i;

const USER_COMMITMENT_MENTIONED =
  /you (?:said|mentioned|promised|agreed|noted) (?:you(?:'|')?d|that you would)|as you mentioned|still waiting (?:for|on) (?:the|your)|when you (?:send|get) (?:a chance|time)/i;

const PROMISED_BY_USER_IN_SNIPPET =
  /i(?:'|')?ll (?:send|share|get back|follow up|confirm)|i will (?:send|share|get back|follow up|confirm)|send (?:you )?(?:the |that )?(?:details|info|pricing|document)/i;

function detectCommitment(hay: string): string | undefined {
  if (USER_COMMITMENT_MENTIONED.test(hay)) {
    const m = hay.match(/still waiting (?:for|on) ([^.?!]{8,80})/i);
    if (m?.[1]) return m[1].trim();
    return "Something you mentioned you'd send";
  }
  if (PROMISED_BY_USER_IN_SNIPPET.test(hay)) {
    return "You may have promised a follow-up in this thread";
  }
  return undefined;
}

function resolveState(input: {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  hay: string;
  intentRequiresReply: boolean;
  replyRecommended: boolean;
  days: number;
  category: InboxAiCategory;
}): ConversationState | null {
  const { hay, intentRequiresReply, replyRecommended, days, category } = input;

  if (category === "promotions" || category === "newsletters") {
    return null;
  }

  const commitment = detectCommitment(hay);
  if (commitment) {
    return "user_commitment_pending";
  }

  if (hasSchedulingIntent(input.row) || /schedule|calendar|meet(?:ing)?/i.test(hay)) {
    return "pending_scheduling";
  }

  if (/awaiting approval|pending approval|need your approval/i.test(hay)) {
    return "awaiting_approval";
  }

  if (/payment due|invoice due|pending payment|awaiting payment/i.test(hay)) {
    return "pending_payment";
  }

  if (AWAITING_YOU.test(hay) || intentRequiresReply) {
    return "awaiting_your_reply";
  }

  if (WAITING_ON_THEM.test(hay)) {
    return days >= 1 ? "follow_up_recommended" : "waiting_for_response";
  }

  if (replyRecommended && days >= 2) {
    return "follow_up_recommended";
  }

  if (replyRecommended) {
    return "conversation_unresolved";
  }

  return null;
}

/**
 * Analyze a message for follow-up / reminder intelligence.
 * Returns null when the message is not a follow-up candidate.
 */
export function analyzeFollowUp(
  row: GmailInboxRow,
  category: InboxAiCategory,
  options?: {
    workflowMode?: "assist" | "clean" | "handle";
    senderRelationships?: SenderRelationship[];
    locale?: "en" | "it";
  },
): FollowUpAnalysis | null {
  const hay = haystack(row);
  const intent = analyzeEmailIntent(row);
  const reply = assessReplyNeed({
    row,
    category,
    workflowMode: options?.workflowMode ?? "assist",
  });

  const days = daysSince(row.internalDateMs);
  const stalledSignals = detectStalledSignals(row, category);
  const baseState = resolveState({
    row,
    hay,
    intentRequiresReply: intent.requiresReply,
    replyRecommended: reply.recommended,
    days,
    category,
  });
  const state = resolveStateWithSmartSignals(baseState, stalledSignals);

  if (!state) return null;

  const relationship = resolveSenderRelationship(
    row,
    category,
    options?.senderRelationships ?? [],
  );

  let urgencyScore =
    scoreFollowUpUrgency({
      state,
      intentKinds: intent.kinds,
      category,
      haystack: hay,
      daysSinceMessage: days,
    }) + relationshipUrgencyBoost(relationship);

  const timeline = analyzeTimelineIntelligence({
    row: toThreadSnapshot({ ...row, category }),
  });
  urgencyScore = Math.max(
    0,
    Math.min(100, urgencyScore + timeline.visibilityBoost),
  );

  const commitment = detectCommitment(hay);
  const baseHeadlines = headlinesForFollowUpState({
    row,
    state,
    days,
    commitment,
    relationship,
    locale: options?.locale ?? "en",
  });
  const { headline, calmPrompt } = relationshipFollowUpHeadline(
    relationship,
    baseHeadlines.headline,
    baseHeadlines.calmPrompt,
  );

  const reasons = [...intent.reasons];
  if (commitment) reasons.push("commitment_detected");
  if (stalledSignals.promisedInformationMissing) reasons.push("promised_info_missing");
  if (stalledSignals.userSentNoReplyHeuristic) reasons.push("user_sent_waiting");

  const base: FollowUpAnalysis = {
    emailId: row.id,
    sender: row.sender,
    subject: row.subject,
    snippet: row.snippet,
    category,
    state,
    urgencyScore,
    headline,
    calmPrompt,
    intentKinds: intent.kinds,
    reasons,
    daysSinceMessage: days,
    suggestedFollowUpDays: state === "waiting_for_response" ? 3 : 2,
    detectedCommitment: commitment,
    stalledSignals,
  };

  const smart = enrichWithSmartFollowUp({
    row,
    analysis: base,
    relationship,
    locale: "en",
  });

  if (!shouldSurfaceInFollowUpSection(smart, urgencyScore)) {
    return null;
  }

  if (smart.displayState === "closed_conversation") {
    return null;
  }

  return {
    ...base,
    displayState: smart.displayState,
    timingSuggestion: smart.timing,
    atRiskOfForgotten: smart.atRiskOfForgotten,
    recentlyActive: smart.recentlyActive,
    suggestedFollowUpDays: smart.suggestedFollowUpDays ?? base.suggestedFollowUpDays,
  };
}

export function analyzeFollowUpBatch(
  rows: Array<GmailInboxRow & { category: InboxAiCategory }>,
  workflowMode?: "assist" | "clean" | "handle",
  senderRelationships?: SenderRelationship[],
): FollowUpAnalysis[] {
  const out: FollowUpAnalysis[] = [];
  for (const row of rows) {
    const analysis = analyzeFollowUp(row, row.category, {
      workflowMode,
      senderRelationships,
    });
    if (analysis) out.push(analysis);
  }
  return out.sort((a, b) => b.urgencyScore - a.urgencyScore);
}
