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

const SCHEDULING =
  /schedule|calendar|meet(?:ing)?|book a (?:time|slot|call)|when are you (?:free|available)|reschedule/i;

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
  hay: string;
  intentRequiresReply: boolean;
  replyRecommended: boolean;
  days: number;
  category: InboxAiCategory;
}): ConversationState | null {
  const { hay, intentRequiresReply, replyRecommended, days, category } = input;

  if (category === "promotion" || category === "newsletter") {
    return null;
  }

  const commitment = detectCommitment(hay);
  if (commitment) {
    return "user_commitment_pending";
  }

  if (SCHEDULING.test(hay)) {
    return "pending_scheduling";
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

function buildHeadlines(
  state: ConversationState,
  name: string,
  days: number,
  subject: string,
  commitment?: string,
): { headline: string; calmPrompt: string } {
  const shortSubject = subject.length > 48 ? `${subject.slice(0, 45)}…` : subject;

  switch (state) {
    case "awaiting_your_reply":
      return {
        headline:
          days > 0
            ? `${name} is waiting — it's been ${days} day${days === 1 ? "" : "s"}`
            : `${name} may be waiting for your reply`,
        calmPrompt: `Regarding “${shortSubject}” — a thoughtful reply when you're ready helps.`,
      };
    case "waiting_for_response":
      return {
        headline:
          days >= 3
            ? `${name} hasn't replied in ${days} days`
            : `Waiting to hear back from ${name}`,
        calmPrompt: "Would you like a gentle follow-up draft when the time feels right?",
      };
    case "follow_up_recommended":
      return {
        headline: `Follow-up may help with ${name}`,
        calmPrompt:
          days >= 2
            ? `This thread has been quiet for ${days} days — no rush, just keeping it on your radar.`
            : "Handled noticed this conversation might benefit from a nudge.",
      };
    case "pending_scheduling":
      return {
        headline: `Scheduling with ${name}`,
        calmPrompt: "A quick reply can lock in a time that works for you.",
      };
    case "user_commitment_pending":
      return {
        headline: commitment ?? `You may owe ${name} a follow-up`,
        calmPrompt: "Handled remembered a possible commitment in this thread — only if it still applies.",
      };
    case "conversation_unresolved":
    default:
      return {
        headline: `Unresolved: ${shortSubject}`,
        calmPrompt: "This conversation may still need your attention when you have a moment.",
      };
  }
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
  const state = resolveState({
    hay,
    intentRequiresReply: intent.requiresReply,
    replyRecommended: reply.recommended,
    days,
    category,
  });

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

  urgencyScore = Math.max(0, Math.min(100, urgencyScore));

  const name = senderFirstNameFromRow(row.sender);
  const commitment = detectCommitment(hay);
  const baseHeadlines = buildHeadlines(state, name, days, row.subject, commitment);
  const { headline, calmPrompt } = relationshipFollowUpHeadline(
    relationship,
    baseHeadlines.headline,
    baseHeadlines.calmPrompt,
  );

  const reasons = [...intent.reasons];
  if (commitment) reasons.push("commitment_detected");

  return {
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
