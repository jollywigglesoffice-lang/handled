import type { ActionLabelId, ImpliedActionKind, TaskAwarenessItem } from "@/lib/action-intelligence/types";
import {
  hasExplicitDeadline,
  hasExplicitQuestion,
  hasExplicitRequest,
  hasExplicitSchedulingRequest,
} from "@/lib/explicit-email-signals";

export function suggestNextAction(input: {
  primaryLabel: ActionLabelId | null;
  implied: ImpliedActionKind[];
  taskAwareness: TaskAwarenessItem[];
  locale?: "en" | "it";
  haystack?: string;
}): string | null {
  const locale = input.locale ?? "en";
  const hay = input.haystack ?? "";
  const dateItem = input.taskAwareness.find((t) => t.kind === "date");
  const when = dateItem?.when;

  if (input.implied.includes("send_file") && hasExplicitRequest(hay)) {
    return locale === "it"
      ? "Allega il file richiesto quando sei pronto."
      : "Attach the requested file when ready.";
  }

  if (input.implied.includes("waiting_on_them")) {
    return locale === "it"
      ? "In attesa della loro risposta — un follow-up leggero può aiutare."
      : "Waiting for their response — a gentle follow-up may help.";
  }

  if (input.primaryLabel === "urgent" || input.implied.includes("urgent")) {
    if (!hasExplicitDeadline(hay) && !/\b(urgent|asap|urgente)\b/i.test(hay)) return null;
    return locale === "it" ? "Rispondi oggi se puoi." : "Reply today if you can.";
  }

  if (input.primaryLabel === "deadline" || input.implied.includes("deadline")) {
    if (!hasExplicitDeadline(hay)) return null;
    if (when) {
      return locale === "it"
        ? `Tieni d'occhio la scadenza (${when}).`
        : `Mind the deadline (${when}).`;
    }
    return locale === "it" ? "Rispetta la scadenza indicata." : "Address the deadline mentioned.";
  }

  if (input.primaryLabel === "payment") {
    return locale === "it"
      ? "Rivedi fattura o pagamento quando hai un momento."
      : "Review the invoice or payment when you have a moment.";
  }

  if (input.primaryLabel === "meeting" || input.implied.includes("scheduling")) {
    if (!hasExplicitSchedulingRequest(hay)) return null;
    return locale === "it"
      ? "Proponi un orario che ti va e invia una bozza."
      : "Offer a time that works and send a draft.";
  }

  if (input.primaryLabel === "review" || input.implied.includes("approval")) {
    if (!hasExplicitRequest(hay)) return null;
    return locale === "it"
      ? "Rivedi e approva quando sei pronto."
      : "Review and approve when ready.";
  }

  if (input.primaryLabel === "follow_up" || input.implied.includes("follow_up")) {
    if (when) {
      return locale === "it"
        ? `Follow-up consigliato (${when}).`
        : `Consider a follow-up (${when}).`;
    }
    return locale === "it" ? "Follow-up domani se non rispondono." : "Follow up tomorrow if no reply.";
  }

  if (input.primaryLabel === "reply_needed" || input.implied.includes("reply_needed")) {
    if (!hasExplicitQuestion(hay) && !hasExplicitRequest(hay)) return null;
    if (when === "tomorrow" || when === "domani") {
      return locale === "it" ? "Rispondi entro domani." : "Reply by tomorrow.";
    }
    return locale === "it" ? "Rispondi quando puoi oggi." : "Reply when you can today.";
  }

  if (input.primaryLabel === "waiting") {
    return locale === "it"
      ? "Nessuna fretta — sei in attesa."
      : "No rush — you're waiting on them.";
  }

  return null;
}
