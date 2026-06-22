import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import {
  isConversationExample,
  onboardingExampleBucket,
} from "@/lib/onboarding/example-buckets";
import type { PresenceAdjustments } from "@/lib/presence/types";

export type PresenceScorableMessage = {
  category: string;
  sender?: string;
  subject?: string;
  snippet?: string;
  actionIntelligence?: { actionable?: boolean };
  autopilot?: { state?: string };
  timeImpact?: { kind?: string };
  timelineIntelligence?: { conversationStatus?: string };
  workflowState?: string;
};

/** Higher = more likely the user wants to see this first — silent ranking only. */
export function scorePresenceActionable(
  message: PresenceScorableMessage,
  adjustments: PresenceAdjustments,
): number {
  let score = 0;

  if (message.category === "worth_your_attention") score += 12;
  if (message.actionIntelligence?.actionable) score += 10;
  if (message.autopilot?.state === "worth_your_attention") score += 6;

  const impact = message.timeImpact?.kind;
  if (impact === "time_sensitive" || impact === "time_blocker") score += 8;

  if (message.timelineIntelligence?.conversationStatus === "waiting") score += 5;
  if (
    message.sender &&
    message.subject &&
    isConversationExample(message as GmailCardMessage)
  ) {
    score += 4;
  }

  if (message.subject && message.snippet) {
    const bucket = onboardingExampleBucket(message as GmailCardMessage);
    if (bucket === "promotions" || bucket === "newsletters") score -= 8;
  }

  if (adjustments.boostActionable && message.actionIntelligence?.actionable) {
    score += 4;
  }
  if (adjustments.prioritizeWaiting && message.workflowState === "waiting_on") {
    score += 6;
  }

  return score;
}

export function pickPresenceOnboardingEmail(
  queue: GmailCardMessage[],
  adjustments: PresenceAdjustments,
): GmailCardMessage | null {
  if (queue.length === 0) return null;
  const ranked = [...queue].sort(
    (a, b) =>
      scorePresenceActionable(b, adjustments) - scorePresenceActionable(a, adjustments),
  );
  return ranked[0] ?? null;
}

export function shouldPresencePrefetchReply(message: GmailCardMessage): boolean {
  if (message.category !== "worth_your_attention") return false;
  if (!message.actionIntelligence?.actionable) return false;
  const impact = message.timeImpact?.kind;
  if (impact === "time_sensitive" || impact === "time_blocker") return true;
  return message.autopilot?.state === "worth_your_attention";
}
