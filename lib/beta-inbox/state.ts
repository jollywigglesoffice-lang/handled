import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import {
  resolveInboxEmotionalState,
  resolveInboxPrimaryAction,
  type InboxPrimaryActionKind,
} from "@/lib/inbox-emotional-state";

/** Only 3 user-visible states in beta. */
export type BetaEmailState = "worth_your_attention" | "suggested";

export type BetaPrimaryAction = {
  kind: InboxPrimaryActionKind;
  label: string;
  /** done = complete in-place; navigate = open email */
  behavior: "done" | "navigate";
};

const STATE_LABEL = {
  en: {
    worth_your_attention: "Needs Attention",
    suggested: "Suggested",
    done: "Done",
  },
  it: {
    worth_your_attention: "Richiede attenzione",
    suggested: "Suggerito",
    done: "Fatto",
  },
} as const;

const ACTION_LABEL = {
  en: { done: "Done", reply: "Reply", open: "Open" },
  it: { done: "Fatto", reply: "Rispondi", open: "Apri" },
} as const;

export function betaStateLabel(state: BetaEmailState, locale: "en" | "it"): string {
  return STATE_LABEL[locale][state];
}

export function betaDoneLabel(locale: "en" | "it"): string {
  return STATE_LABEL[locale].done;
}

export function resolveBetaEmailState(message: GmailCardMessage): BetaEmailState {
  if (message.autopilot?.state === "worth_your_attention") return "worth_your_attention";
  if (message.autopilot?.state === "assisted") return "suggested";
  if (message.category === "worth_your_attention") {
    return "worth_your_attention";
  }
  const emotional = resolveInboxEmotionalState({
    category: message.category,
    actionIntelligence: message.actionIntelligence,
    calendarIntentLevel: message.calendarIntentLevel,
    waitingResponseUpdate: message.waitingResponseUpdate,
    timeImpactKind: message.timeImpact?.kind,
  });
  if (emotional === "action") return "worth_your_attention";
  return "suggested";
}

export function resolveBetaPrimaryAction(
  message: GmailCardMessage,
  locale: "en" | "it",
): BetaPrimaryAction {
  const kind = resolveInboxPrimaryAction({
    category: message.category,
    actionIntelligence: message.actionIntelligence,
    calendarIntentLevel: message.calendarIntentLevel,
    waitingResponseUpdate: message.waitingResponseUpdate,
    timeImpactKind: message.timeImpact?.kind,
  });
  const t = ACTION_LABEL[locale];

  if (kind === "ignore") {
    return { kind, label: t.done, behavior: "done" };
  }
  if (kind === "reply") {
    return { kind, label: t.reply, behavior: "navigate" };
  }
  return { kind, label: t.open, behavior: "navigate" };
}

/** Needs attention first, then suggested. */
export function sortBetaQueue(messages: GmailCardMessage[]): GmailCardMessage[] {
  return [...messages].sort((a, b) => {
    const sa = resolveBetaEmailState(a);
    const sb = resolveBetaEmailState(b);
    if (sa === sb) return 0;
    if (sa === "worth_your_attention") return -1;
    return 1;
  });
}

export function countBetaStates(messages: GmailCardMessage[]): {
  worth_your_attention: number;
  suggested: number;
} {
  let worth_your_attention = 0;
  let suggested = 0;
  for (const m of messages) {
    if (resolveBetaEmailState(m) === "worth_your_attention") worth_your_attention += 1;
    else suggested += 1;
  }
  return { worth_your_attention, suggested };
}
