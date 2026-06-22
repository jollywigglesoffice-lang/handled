import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

const CALM_PRIORITY_CATEGORIES: InboxAiCategory[] = [
  "worth_your_attention",
  "good_to_know",
];

function isCalmPriorityMessage(message: GmailCardMessage): boolean {
  if (message.category === "worth_your_attention") return true;

  if (message.category === "good_to_know") {
    const impact = message.timeImpact?.kind;
    if (impact === "time_sensitive" || impact === "time_blocker") return true;
    if (message.actionIntelligence?.actionable) return true;
    if (message.timelineIntelligence?.conversationStatus === "waiting") return true;
  }

  return false;
}

/** In calm mode, show only actionable / time-sensitive mail. */
export function filterCalmPriorityMessages(messages: GmailCardMessage[]): GmailCardMessage[] {
  return messages.filter(isCalmPriorityMessage);
}

export function isCalmPriorityCategory(category: InboxAiCategory): boolean {
  return CALM_PRIORITY_CATEGORIES.includes(category);
}

export function limitCalmSectionList(
  messages: GmailCardMessage[],
  max: number,
): GmailCardMessage[] {
  return messages.slice(0, max);
}
