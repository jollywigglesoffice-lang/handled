import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { resolveBetaEmailState, type BetaEmailState } from "@/lib/beta-inbox/state";

/** AI suggestion layer — does not replace categories. */
export type BetaAiFilter = "all" | BetaEmailState;

export function applyBetaAiFilter<T extends GmailCardMessage>(
  messages: T[],
  filter: BetaAiFilter,
): T[] {
  if (filter === "all") return messages;
  return messages.filter((m) => resolveBetaEmailState(m) === filter);
}

export function countBetaAiFilter(messages: GmailCardMessage[]): Record<BetaAiFilter, number> {
  let worth_your_attention = 0;
  let suggested = 0;
  for (const m of messages) {
    if (resolveBetaEmailState(m) === "worth_your_attention") worth_your_attention += 1;
    else suggested += 1;
  }
  return {
    all: messages.length,
    worth_your_attention,
    suggested,
  };
}
