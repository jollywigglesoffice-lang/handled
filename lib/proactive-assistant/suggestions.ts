import type {
  IncompleteAction,
  ProactiveSuggestion,
  ProactiveSuggestionKind,
  UpcomingCommitment,
} from "@/lib/proactive-assistant/types";

function suggestionId(emailId: string, kind: ProactiveSuggestionKind): string {
  return `${emailId}:${kind}`;
}

export function buildProactiveSuggestions(input: {
  emailId: string;
  threadId?: string;
  sender: string;
  subject: string;
  commitments: UpcomingCommitment[];
  incomplete: IncompleteAction[];
  locale: "en" | "it";
  urgencyScore: number;
  options?: {
    isVip?: boolean;
    daysSince?: number;
    meetingTomorrow?: boolean;
    travelDetected?: boolean;
  };
}): ProactiveSuggestion[] {
  const locale = input.locale;
  const suggestions: ProactiveSuggestion[] = [];
  const opts = input.options ?? {};

  if (opts.isVip && (opts.daysSince ?? 0) >= 2) {
    suggestions.push({
      id: suggestionId(input.emailId, "vip_unanswered"),
      emailId: input.emailId,
      threadId: input.threadId,
      sender: input.sender,
      subject: input.subject,
      kind: "vip_unanswered",
      message:
        locale === "it"
          ? "Email importante in attesa — potresti rispondere quando vuoi."
          : "Important email waiting — you may want to reply when ready.",
      urgencyScore: Math.min(100, input.urgencyScore + 8),
      requiresUserApproval: true,
      dismissible: true,
    });
  }

  if ((opts.daysSince ?? 0) >= 3) {
    suggestions.push({
      id: suggestionId(input.emailId, "follow_up_today"),
      emailId: input.emailId,
      threadId: input.threadId,
      sender: input.sender,
      subject: input.subject,
      kind: "follow_up_today",
      message:
        locale === "it"
          ? "Potresti fare un follow-up oggi — solo se ti va."
          : "You may want to follow up today — only if it feels right.",
      calmDetail:
        locale === "it"
          ? "Nessun invio automatico."
          : "Handled will not send anything for you.",
      urgencyScore: input.urgencyScore,
      requiresUserApproval: true,
      dismissible: true,
    });
  }

  for (const c of input.commitments) {
    if (c.kind === "deadline") {
      suggestions.push({
        id: suggestionId(input.emailId, "deadline_approaching"),
        emailId: input.emailId,
        threadId: input.threadId,
        sender: input.sender,
        subject: input.subject,
        kind: "deadline_approaching",
        message:
          locale === "it"
            ? `Scadenza in vista${c.whenHint ? ` (${c.whenHint})` : ""}.`
            : `A deadline is coming up${c.whenHint ? ` (${c.whenHint})` : ""}.`,
        calmDetail: c.description,
        urgencyScore: Math.min(100, input.urgencyScore + 6),
        requiresUserApproval: true,
        dismissible: true,
      });
    }
    if (c.kind === "promised_follow_up") {
      suggestions.push({
        id: suggestionId(input.emailId, "commitment_due"),
        emailId: input.emailId,
        threadId: input.threadId,
        sender: input.sender,
        subject: input.subject,
        kind: "commitment_due",
        message:
          locale === "it"
            ? "Hai accennato a un follow-up in questo thread."
            : "You mentioned a follow-up in this thread.",
        calmDetail: c.description,
        urgencyScore: input.urgencyScore,
        requiresUserApproval: true,
        dismissible: true,
      });
    }
    if (c.kind === "meeting" && opts.meetingTomorrow) {
      suggestions.push({
        id: suggestionId(input.emailId, "meeting_unconfirmed"),
        emailId: input.emailId,
        threadId: input.threadId,
        sender: input.sender,
        subject: input.subject,
        kind: "meeting_unconfirmed",
        message:
          locale === "it"
            ? "Riunione domani — conferma ancora da definire."
            : "Meeting is tomorrow and may still need confirmation.",
        urgencyScore: Math.min(100, input.urgencyScore + 5),
        requiresUserApproval: true,
        dismissible: true,
      });
    }
    if (c.kind === "approval") {
      suggestions.push({
        id: suggestionId(input.emailId, "pending_approval"),
        emailId: input.emailId,
        threadId: input.threadId,
        sender: input.sender,
        subject: input.subject,
        kind: "pending_approval",
        message:
          locale === "it"
            ? "Approvazione in sospeso — quando sei pronto."
            : "Approval may be pending — when you're ready.",
        urgencyScore: input.urgencyScore,
        requiresUserApproval: true,
        dismissible: true,
      });
    }
    if (c.kind === "payment") {
      suggestions.push({
        id: suggestionId(input.emailId, "payment_pending"),
        emailId: input.emailId,
        threadId: input.threadId,
        sender: input.sender,
        subject: input.subject,
        kind: "payment_pending",
        message:
          locale === "it"
            ? "Pagamento o fattura da rivedere."
            : "Payment or invoice may need your review.",
        urgencyScore: input.urgencyScore,
        requiresUserApproval: true,
        dismissible: true,
      });
    }
  }

  if (opts.travelDetected) {
    suggestions.push({
      id: suggestionId(input.emailId, "travel_context"),
      emailId: input.emailId,
      threadId: input.threadId,
      sender: input.sender,
      subject: input.subject,
      kind: "travel_context",
      message:
        locale === "it"
          ? "Email di viaggio rilevata — utile tenerla a portata di mano."
          : "Travel-related email detected — worth keeping handy.",
      urgencyScore: Math.max(30, input.urgencyScore - 15),
      requiresUserApproval: true,
      dismissible: true,
    });
  }

  for (const inc of input.incomplete) {
    const kind: ProactiveSuggestionKind =
      inc.kind === "attachment"
        ? "missing_attachment"
        : inc.kind === "scheduling"
          ? "scheduling_open"
          : "incomplete_action";
    if (suggestions.some((s) => s.kind === kind)) continue;
    suggestions.push({
      id: suggestionId(input.emailId, kind),
      emailId: input.emailId,
      threadId: input.threadId,
      sender: input.sender,
      subject: input.subject,
      kind,
      message: inc.description,
      calmDetail:
        locale === "it"
          ? "Suggerimento — tu decidi se agire."
          : "A gentle nudge — you decide whether to act.",
      urgencyScore: input.urgencyScore,
      requiresUserApproval: true,
      dismissible: true,
    });
  }

  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.kind)) return false;
    seen.add(s.kind);
    return true;
  });
}
