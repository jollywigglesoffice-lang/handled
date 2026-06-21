import type { ActionIntelligenceSummary, ActionLabelId } from "@/lib/action-intelligence";
import type { TimeImpactKind } from "@/lib/time-impact/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { ConversationStatus } from "@/lib/timeline-intelligence";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

/** Single visible emotional posture for inbox cards. */
export type InboxEmotionalState = "calm" | "attention" | "action";

/** One primary verb the user can take — no competing CTAs. */
export type InboxPrimaryActionKind = "reply" | "review" | "ignore" | "schedule" | "open";

export type InboxEmotionalInput = {
  category: InboxAiCategory;
  actionIntelligence?: ActionIntelligenceSummary;
  calendarIntentLevel?: "SCHEDULE_REQUIRED" | "SOFT_SCHEDULING" | "TIME_SENSITIVE" | "NO_TIME_CONTEXT";
  waitingResponseUpdate?: boolean;
  timelineStatus?: ConversationStatus;
  timeImpactKind?: TimeImpactKind;
};

export function resolveInboxEmotionalState(input: InboxEmotionalInput): InboxEmotionalState {
  const actionState = input.actionIntelligence?.actionState;
  const primaryLabel = input.actionIntelligence?.primaryLabel;

  if (input.waitingResponseUpdate) return "attention";

  if (actionState === "actionable") {
    if (
      primaryLabel === "reply_needed" ||
      primaryLabel === "urgent" ||
      input.category === "worth_your_attention"
    ) {
      return "action";
    }
    return "attention";
  }

  if (actionState === "waiting_response") return "attention";

  if (
    actionState === "passive" ||
    input.category === "good_to_know" ||
    input.category === "newsletters" ||
    input.category === "promotions"
  ) {
    return "calm";
  }

  const timeline = input.timelineStatus;
  if (
    timeline === "stalled" ||
    timeline === "escalating" ||
    timeline === "waiting"
  ) {
    return "attention";
  }

  if (
    primaryLabel === "review" ||
    primaryLabel === "deadline" ||
    primaryLabel === "payment" ||
    primaryLabel === "follow_up" ||
    primaryLabel === "waiting" ||
    primaryLabel === "meeting"
  ) {
    return "attention";
  }

  return "calm";
}

export function resolveInboxPrimaryAction(input: InboxEmotionalInput): InboxPrimaryActionKind {
  if (input.calendarIntentLevel === "SCHEDULE_REQUIRED") return "schedule";

  const emotional = resolveInboxEmotionalState(input);
  const primaryLabel = input.actionIntelligence?.primaryLabel;

  if (emotional === "calm") return "ignore";

  if (primaryLabel === "deadline") {
    return "review";
  }

  if (
    emotional === "action" &&
    (primaryLabel === "reply_needed" ||
      primaryLabel === "urgent" ||
      input.category === "worth_your_attention")
  ) {
    return "reply";
  }

  if (
    emotional === "attention" ||
    primaryLabel === "review" ||
    primaryLabel === "payment" ||
    primaryLabel === "follow_up" ||
    primaryLabel === "waiting"
  ) {
    return "review";
  }

  if (emotional === "action") return "reply";

  return "open";
}

const EMOTIONAL_COPY = {
  en: { calm: "Calm", attention: "Attention", action: "Action" },
  it: { calm: "Calma", attention: "Attenzione", action: "Azione" },
} as const;

const PRIMARY_COPY = {
  en: {
    reply: "Reply",
    review: "Review",
    ignore: "No action needed",
    schedule: "Schedule",
    open: "Open",
  },
  it: {
    reply: "Rispondi",
    review: "Rivedi",
    ignore: "Nessuna azione necessaria",
    schedule: "Programma",
    open: "Apri",
  },
} as const;

export function inboxEmotionalLabel(state: InboxEmotionalState, locale: "en" | "it"): string {
  return EMOTIONAL_COPY[locale][state];
}

export function inboxPrimaryActionLabel(
  kind: InboxPrimaryActionKind,
  locale: "en" | "it",
): string {
  return PRIMARY_COPY[locale][kind];
}

export function inboxEmotionalTone(state: InboxEmotionalState): {
  dot: string;
  text: string;
} {
  switch (state) {
    case "action":
      return { dot: "bg-sky-500", text: "text-sky-600/80" };
    case "attention":
      return { dot: "bg-amber-400", text: "text-amber-700/70" };
    case "calm":
    default:
      return { dot: "bg-gray-300", text: "text-gray-400" };
  }
}

export type InboxMetaDetailsInput = {
  locale: "en" | "it";
  categoryLabel: string;
  showNewsletterBadge?: boolean;
  newsletterLabel?: string;
  learnedApplied?: boolean;
  manualOverride?: boolean;
  needsCalendarContext?: boolean;
  relationship?: SenderRelationshipProfile;
  accountLabel?: string;
  showAccountBadge?: boolean;
  waitingResponseUpdate?: boolean;
  timelineStatus?: ConversationStatus;
  primaryLabel?: ActionLabelId | null;
};

/** Single collapsed meta line — all former chips join here. */
export function buildInboxMetaDetails(input: InboxMetaDetailsInput): string {
  const parts: string[] = [input.categoryLabel];

  if (input.showAccountBadge && input.accountLabel) {
    parts.push(input.accountLabel);
  }
  if (input.showNewsletterBadge && input.newsletterLabel) {
    parts.push(input.newsletterLabel);
  }
  if (input.waitingResponseUpdate) {
    parts.push(input.locale === "it" ? "Risposta ricevuta" : "Response received");
  }
  if (input.timelineStatus === "escalating") {
    parts.push(input.locale === "it" ? "Thread in escalatione" : "Thread escalating");
  } else if (input.timelineStatus === "stalled") {
    parts.push(input.locale === "it" ? "Thread in stallo" : "Thread stalled");
  }
  if (input.relationship?.label) {
    parts.push(input.relationship.label);
  }
  if (input.learnedApplied) {
    parts.push(input.locale === "it" ? "Regola applicata" : "Rule applied");
  }
  if (input.manualOverride) {
    parts.push(input.locale === "it" ? "Modificato da te" : "You changed this");
  }

  return parts.join(" · ");
}
