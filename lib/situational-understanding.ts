import {
  hasExplicitDeadline,
  hasExplicitQuestion,
  hasExplicitRequest,
  hasExplicitSchedulingRequest,
  isAnnouncementEmail,
  rowHaystack,
} from "@/lib/explicit-email-signals";
import { extractDeadlinePhrase } from "@/lib/glance-clarity";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { isCommercialBulk } from "@/lib/inbox-triage-signals";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export type SituationInput = Pick<GmailInboxRow, "sender" | "subject" | "snippet"> & {
  bodyPlain?: string;
};

export type SituationContext = {
  category: InboxAiCategory;
  locale?: "en" | "it";
  relationship?: SenderRelationshipProfile | null;
  replyRecommended?: boolean;
  suggestedNextAction?: string | null;
  schedulingDetected?: boolean;
};

export type SituationBundle = {
  /** Extractive only — describes what is explicitly present. */
  summary: string;
  /** Optional labeled inference when explicit triggers exist in the source. */
  interpretation: string | null;
  chips: string[];
  nextStep: string | null;
};

/** Display name from From header — "Acme <a@b.com>" → "Acme" */
export function senderDisplayName(sender: string): string {
  const trimmed = sender.trim();
  const quoted = trimmed.match(/^"([^"]+)"/);
  if (quoted?.[1]) return quoted[1].trim();
  const beforeAngle = trimmed.split("<")[0]?.trim();
  if (beforeAngle && beforeAngle.length > 1 && !beforeAngle.includes("@")) {
    return beforeAngle.replace(/^['"]|['"]$/g, "");
  }
  const email = trimmed.match(/[\w.+-]+@([\w.-]+)/);
  if (email?.[1]) {
    const domain = email[1].split(".")[0] ?? "";
    if (domain && !/^(gmail|google|yahoo|outlook|hotmail|icloud)$/i.test(domain)) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }
  return trimmed.slice(0, 48) || "They";
}

function cleanSubject(subject: string): string {
  return subject.replace(/^(re|fwd?|r):\s*/gi, "").trim().slice(0, 80);
}

/** Use the Gmail snippet verbatim — no reinterpretation. */
function extractiveSnippetText(snippet: string | undefined, maxLen = 140): string | null {
  if (!snippet?.trim()) return null;
  const t = snippet.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut}…`;
}

function interpretationPrefix(locale: "en" | "it"): string {
  return locale === "it" ? "Possibile intento: " : "Possible intent: ";
}

/**
 * Labeled inference — only when explicit triggers exist in the email text.
 * Never invents obligations from announcements or vague category guesses.
 */
export function buildSuggestedInterpretation(
  row: SituationInput,
  context: SituationContext,
): string | null {
  const locale = context.locale ?? "en";
  const hay = rowHaystack(row, row.bodyPlain);
  const prefix = interpretationPrefix(locale);

  if (isAnnouncementEmail(hay)) return null;

  if (hasExplicitSchedulingRequest(hay)) {
    if (/reschedul|riprenot|new time|nuovo orario|postpone|spostare/i.test(hay)) {
      return locale === "it"
        ? `${prefix}richiesta di spostare un appuntamento.`
        : `${prefix}request to reschedule a meeting.`;
    }
    return locale === "it"
      ? `${prefix}richiesta di fissare un incontro o una chiamata.`
      : `${prefix}request to schedule a meeting or call.`;
  }

  if (hasExplicitDeadline(hay)) {
    const deadline = extractDeadlinePhrase(hay, locale);
    return deadline
      ? locale === "it"
        ? `${prefix}scadenza menzionata (${deadline}).`
        : `${prefix}deadline mentioned (${deadline}).`
      : locale === "it"
        ? `${prefix}scadenza menzionata nel messaggio.`
        : `${prefix}deadline mentioned in the message.`;
  }

  if (hasExplicitQuestion(hay)) {
    return locale === "it"
      ? `${prefix}domanda diretta che potrebbe richiedere risposta.`
      : `${prefix}direct question that may need a reply.`;
  }

  if (hasExplicitRequest(hay)) {
    return locale === "it"
      ? `${prefix}richiesta esplicita nel messaggio.`
      : `${prefix}explicit request in the message.`;
  }

  if (/payment failed|declined|non riuscito|rifiutato/i.test(hay) && /payment|billing|pagamento/i.test(hay)) {
    return locale === "it"
      ? `${prefix}problema di pagamento da verificare.`
      : `${prefix}payment issue to review.`;
  }

  return null;
}

/** Strictly extractive — only what is explicitly present in subject/snippet. */
export function buildExtractiveSummary(
  row: SituationInput,
  category: InboxAiCategory,
  context: SituationContext = { category },
): string {
  const locale = context.locale ?? "en";
  const hay = rowHaystack(row, row.bodyPlain);
  const who = senderDisplayName(row.sender);
  const topic = cleanSubject(row.subject ?? "");
  const snippet = extractiveSnippetText(row.snippet);

  if (category === "promotions") {
    if (topic) {
      return locale === "it"
        ? `Promozione da ${who}: «${topic}».`
        : `Promotion from ${who}: "${topic}".`;
    }
    return locale === "it"
      ? `Promozione da ${who}.`
      : `Promotion from ${who}.`;
  }

  if (category === "newsletters") {
    if (topic) {
      return locale === "it" ? `Newsletter: «${topic}».` : `Newsletter: "${topic}".`;
    }
    return locale === "it" ? `Newsletter da ${who}.` : `Newsletter from ${who}.`;
  }

  if (category === "good_to_know") {
    if (/receipt|invoice|payment received|ricevuta|fattura/i.test(hay)) {
      return locale === "it"
        ? `Ricevuta o conferma pagamento da ${who}.`
        : `Receipt or payment confirmation from ${who}.`;
    }
    if (/shipped|tracking|delivery|spedizione|consegna/i.test(hay)) {
      return locale === "it"
        ? `Aggiornamento spedizione da ${who}.`
        : `Shipping update from ${who}.`;
    }
    if (topic) {
      return locale === "it"
        ? `Aggiornamento automatico da ${who}: «${topic}».`
        : `Automated update from ${who}: "${topic}".`;
    }
    return locale === "it"
      ? `Aggiornamento automatico da ${who}.`
      : `Automated update from ${who}.`;
  }

  if (isAnnouncementEmail(hay)) {
    if (topic) {
      return locale === "it"
        ? `Comunicazione da ${who}: «${topic}».`
        : `Announcement from ${who}: "${topic}".`;
    }
    return locale === "it"
      ? `Comunicazione da ${who}.`
      : `Announcement from ${who}.`;
  }

  if (topic && snippet) {
    return locale === "it"
      ? `Email da ${who} — «${topic}». ${snippet}`
      : `Email from ${who} — "${topic}". ${snippet}`;
  }

  if (topic) {
    return locale === "it"
      ? `Email da ${who} — oggetto: «${topic}».`
      : `Email from ${who} — subject: "${topic}".`;
  }

  if (snippet) {
    return `${who}: ${snippet}`;
  }

  return locale === "it" ? `Email da ${who}.` : `Email from ${who}.`;
}

/** Returns extractive summary only (no labeled inference). */
export function buildSituationSummary(
  row: SituationInput,
  category: InboxAiCategory,
  context: SituationContext = { category },
): string {
  return buildExtractiveSummary(row, category, context);
}

export function deriveIntentChips(
  row: SituationInput,
  context: SituationContext,
): string[] {
  const locale = context.locale ?? "en";
  const hay = rowHaystack(row, row.bodyPlain);
  const chips: string[] = [];
  const add = (en: string, it: string) => {
    const label = locale === "it" ? it : en;
    if (!chips.includes(label)) chips.push(label);
  };

  if (context.relationship?.kind === "school") add("School", "Scuola");
  if (context.relationship?.kind === "healthcare") add("Health", "Salute");
  if (context.relationship?.kind === "family") add("Family", "Famiglia");

  if (isAnnouncementEmail(hay)) {
    add("Announcement", "Comunicazione");
    return chips.slice(0, 5);
  }

  if (hasExplicitSchedulingRequest(hay)) {
    if (/reschedul|riprenot|new time|nuovo orario/i.test(hay)) add("Reschedule", "Riprenotare");
    else add("Scheduling", "Appuntamento");
  }

  if (/payment|billing|subscription|pagamento|abbonamento/i.test(hay)) {
    if (/failed|declined|non riuscito/i.test(hay)) add("Payment issue", "Problema pagamento");
    else add("Billing", "Fatturazione");
  }

  if (/pricing|quote|preventivo/i.test(hay) && hasExplicitQuestion(hay)) add("Pricing", "Prezzi");
  if (/support|issue|problem|bug/i.test(hay) && hasExplicitRequest(hay)) add("Support", "Supporto");
  if (hasExplicitRequest(hay) && /approv|decision|firma/i.test(hay)) add("Needs decision", "Decisione");

  const lowUrgency =
    context.category === "promotions" ||
    context.category === "newsletters" ||
    context.category === "good_to_know" ||
    isCommercialBulk(row as GmailInboxRow);

  if (hasExplicitDeadline(hay) && !lowUrgency) {
    add("Worth checking today", "Da vedere oggi");
  }

  if (hasExplicitQuestion(hay) && !lowUrgency) {
    add("Question", "Domanda");
  } else if (lowUrgency) {
    add("Can wait", "Può aspettare");
  }

  if (/waiting|follow up|in attesa/i.test(hay) && hasExplicitRequest(hay)) {
    add("Waiting for confirmation", "In attesa conferma");
  }

  return chips.slice(0, 5);
}

/** Strip classifier-style phrasing from next-step lines. */
export function polishNextStep(text: string | null | undefined, locale: "en" | "it"): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();

  if (/scheduling request|calendar context will help|richiesta di programmazione/i.test(t)) {
    return locale === "it"
      ? "Scegli un orario e rispondi con una bozza."
      : "Pick a time that works and send a draft reply.";
  }
  if (/likely needs a reply|probabilmente serve una risposta|suggests replying/i.test(t)) {
    return locale === "it" ? "Rispondi quando puoi." : "Reply when you can.";
  }
  if (/reply today|rispondi oggi/i.test(t)) {
    return locale === "it" ? "Rispondi oggi." : "Reply today.";
  }
  if (/pricing or plan inquiry|preventivo/i.test(t)) {
    return locale === "it" ? "Condividi i dettagli sui prezzi." : "Share pricing details when ready.";
  }
  if (/review and respond|review and reply/i.test(t)) {
    return locale === "it" ? "Rispondi quando hai un momento." : "Reply when you have a moment.";
  }
  if (/safe to archive|no reply needed|nessuna risposta/i.test(t)) {
    return locale === "it" ? "Archivia quando hai finito." : "Archive when you're done.";
  }

  return t;
}

export function buildSituationBundle(
  row: SituationInput,
  context: SituationContext,
): SituationBundle {
  const summary = buildExtractiveSummary(row, context.category, context);
  const interpretation = buildSuggestedInterpretation(row, context);
  const chips = deriveIntentChips(row, context);
  const nextStep = polishNextStep(context.suggestedNextAction, context.locale ?? "en");
  return { summary, interpretation, chips, nextStep };
}
