import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { EmailIntentKind } from "@/lib/email-intent";
import type { ConversationState } from "@/lib/follow-up/types";

const FAMILY_SCHOOL =
  /teacher|school|parent|pta|conference|homework|classroom|principal|nurse|pediatric|daycare/i;

const BUSINESS_HIGH =
  /pricing|proposal|contract|invoice due|partnership|demo|enterprise|client|customer/i;

export function scoreFollowUpUrgency(input: {
  state: ConversationState;
  intentKinds: EmailIntentKind[];
  category: InboxAiCategory;
  haystack: string;
  daysSinceMessage: number;
}): number {
  let score = 40;

  if (input.category === "promotion" || input.category === "newsletter") {
    return Math.min(score, 25);
  }
  if (input.category === "handled") {
    score -= 15;
  }

  const kinds = new Set(input.intentKinds);

  if (kinds.has("pricing_inquiry") || kinds.has("sales_lead")) score += 28;
  if (kinds.has("deadline") || kinds.has("urgent_request")) score += 25;
  if (kinds.has("scheduling")) score += 18;
  if (kinds.has("decision_required")) score += 20;
  if (kinds.has("support_request")) score += 15;
  if (kinds.has("direct_question")) score += 10;

  if (FAMILY_SCHOOL.test(input.haystack)) score += 22;
  if (BUSINESS_HIGH.test(input.haystack)) score += 12;

  if (input.state === "awaiting_your_reply") score += 12;
  if (input.state === "awaiting_approval") score += 16;
  if (input.state === "pending_payment") score += 14;
  if (input.state === "user_commitment_pending") score += 18;
  if (input.state === "follow_up_recommended") score += 8;
  if (input.state === "waiting_for_response") score += 5;

  if (input.daysSinceMessage >= 3) score += Math.min(15, input.daysSinceMessage * 2);
  if (input.daysSinceMessage >= 7) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}
