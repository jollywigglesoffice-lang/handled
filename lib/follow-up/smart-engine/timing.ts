import type { ConversationState } from "@/lib/follow-up/types";
import type {
  FollowUpTimingSuggestion,
  FollowUpTimingTone,
  StalledConversationSignals,
} from "@/lib/follow-up/smart-engine/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export function suggestFollowUpTiming(input: {
  state: ConversationState;
  daysSinceMessage: number;
  urgencyScore: number;
  signals: StalledConversationSignals;
  relationship?: SenderRelationshipProfile | null;
  locale?: "en" | "it";
}): FollowUpTimingSuggestion {
  const locale = input.locale ?? "en";
  const { daysSinceMessage: days, urgencyScore, signals, relationship } = input;

  let suggestedInDays = 2;
  let tone: FollowUpTimingTone = "gentle";

  if (relationship?.importance === "vip" || relationship?.kind === "vip_client") {
    suggestedInDays = days >= 2 ? 1 : 2;
    tone = days >= 5 ? "consider_escalation" : "normal";
  } else if (relationship?.kind === "family") {
    suggestedInDays = 3;
    tone = "gentle";
  } else if (relationship?.kind === "school") {
    suggestedInDays = days >= 3 ? 2 : 3;
    tone = "gentle";
  } else if (relationship?.kind === "client" || relationship?.kind === "team") {
    suggestedInDays = days >= 4 ? 2 : 3;
    tone = days >= 7 ? "consider_escalation" : "normal";
  }

  if (signals.pendingPayment || signals.pendingApproval) {
    suggestedInDays = Math.min(suggestedInDays, days >= 3 ? 1 : 2);
    tone = days >= 7 ? "consider_escalation" : "normal";
  }

  if (input.state === "awaiting_your_reply") {
    return {
      suggestedInDays: 0,
      tone: "normal",
      message:
        locale === "it"
          ? "Rispondi quando puoi — nessuna pressione."
          : "Reply when you can — no pressure.",
    };
  }

  if (days < 2 && input.state === "waiting_for_response") {
    return {
      suggestedInDays: Math.max(2, 3 - days),
      tone: "gentle",
      message:
        locale === "it"
          ? "Ancora recente — puoi attendere qualche giorno."
          : "Still recent — you can wait a couple more days.",
    };
  }

  if (days >= 7 && urgencyScore >= 55) {
    tone = "consider_escalation";
    suggestedInDays = 1;
    return {
      suggestedInDays,
      tone,
      message:
        locale === "it"
          ? "Un promemoria gentile potrebbe aiutare — solo se ti senti a tuo agio."
          : "A gentle reminder may help — only if you feel comfortable.",
    };
  }

  if (days >= 3) {
    suggestedInDays = 1;
    return {
      suggestedInDays,
      tone,
      message:
        locale === "it"
          ? "Follow-up consigliato domani o quando preferisci."
          : "Follow up tomorrow, or whenever feels right.",
    };
  }

  if (suggestedInDays <= 1) {
    return {
      suggestedInDays,
      tone,
      message:
        locale === "it"
          ? "Follow-up domani se non rispondono."
          : "Follow up tomorrow if you do not hear back.",
    };
  }

  return {
    suggestedInDays,
    tone,
    message:
      locale === "it"
        ? `Puoi attendere ancora ${suggestedInDays} giorni — nessuna fretta.`
        : `Wait ${suggestedInDays} more days — no rush.`,
  };
}
