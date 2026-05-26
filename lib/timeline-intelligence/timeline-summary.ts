import type {
  ConversationProgression,
  ConversationStatus,
  ThreadMemory,
} from "@/lib/timeline-intelligence/types";

export function buildTimelineSummary(input: {
  status: ConversationStatus;
  daysSinceLatest: number;
  memory: ThreadMemory;
  progression: ConversationProgression;
  escalationOrdinal?: number;
  senderLabel: string;
  locale?: "en" | "it";
}): { primary: string; detail?: string } {
  const locale = input.locale ?? "en";
  const days = input.daysSinceLatest;
  const d = days === 1 ? (locale === "it" ? "1 giorno" : "1 day") : `${days} ${locale === "it" ? "giorni" : "days"}`;

  if (input.status === "resolved") {
    return {
      primary:
        locale === "it"
          ? "Conversazione probabilmente chiusa."
          : "This conversation looks complete.",
    };
  }

  if (input.escalationOrdinal && input.escalationOrdinal >= 3) {
    return {
      primary:
        locale === "it"
          ? `${input.escalationOrdinal}° follow-up da ${input.senderLabel}.`
          : `${ordinalEn(input.escalationOrdinal)} follow-up from ${input.senderLabel}.`,
      detail:
        locale === "it"
          ? `In attesa da ${d} — senza fretta.`
          : `Waiting ${d} for a response — no rush.`,
    };
  }

  if (input.progression.repeatedFollowUps && input.memory.followUpCount >= 2) {
    return {
      primary:
        locale === "it"
          ? `Follow-up ripetuti in questo thread.`
          : `Repeated follow-ups in this thread.`,
      detail:
        locale === "it"
          ? `Ultimo messaggio ${d} fa.`
          : `Latest message ${d} ago.`,
    };
  }

  if (input.status === "escalating") {
    return {
      primary:
        locale === "it"
          ? `Il tono è un po' più insistente oggi.`
          : `The tone has picked up a little recently.`,
      detail:
        locale === "it"
          ? `Da ${input.senderLabel} — ${d} fa.`
          : `From ${input.senderLabel} — ${d} ago.`,
    };
  }

  if (input.status === "stalled" || (input.status === "waiting" && days >= 5)) {
    return {
      primary:
        locale === "it"
          ? `In attesa di risposta da ${d}.`
          : `Waiting ${d} for a response.`,
      detail:
        locale === "it"
          ? "Handled tiene d'occhio il thread — nessuna azione automatica."
          : "Handled is keeping this thread visible — no automatic action.",
    };
  }

  if (input.status === "waiting") {
    return {
      primary:
        locale === "it"
          ? `In attesa di risposta (${d}).`
          : `Waiting for a response (${d}).`,
    };
  }

  if (input.status === "needs_follow_up") {
    return {
      primary:
        locale === "it"
          ? "Potrebbe servire un tuo follow-up."
          : "You may want to follow up when ready.",
    };
  }

  if (input.progression.longRunning) {
    return {
      primary:
        locale === "it"
          ? `Conversazione attiva da ${input.progression.threadSpanDays} giorni.`
          : `Conversation active for ${input.progression.threadSpanDays} days.`,
    };
  }

  if (input.memory.mentionedDeadlines.length) {
    return {
      primary:
        locale === "it"
          ? `Scadenza citata: ${input.memory.mentionedDeadlines[0]}.`
          : `Deadline mentioned: ${input.memory.mentionedDeadlines[0]}.`,
    };
  }

  return {
    primary:
      locale === "it"
        ? "Thread aperto — nessuna urgenza rilevata."
        : "Open thread — no urgency detected.",
  };
}

function ordinalEn(n: number): string {
  if (n === 2) return "Second";
  if (n === 3) return "Third";
  if (n === 4) return "Fourth";
  return `${n}th`;
}
