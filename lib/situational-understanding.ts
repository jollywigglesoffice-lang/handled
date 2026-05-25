import { detectSchedulingIntent } from "@/lib/calendar-awareness";
import { analyzeEmailIntent, type EmailIntentKind } from "@/lib/email-intent";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { emailHaystack, isCommercialBulk } from "@/lib/inbox-triage-signals";
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

function childNameFromHaystack(hay: string): string | null {
  const m =
    hay.match(/\b(?:son|daughter|child|figlio|figlia)\s+([A-Z][a-zà-ù]{2,20})\b/i) ??
    hay.match(/\b([A-Z][a-zà-ù]{2,20})(?:'s)?\s+(?:school|class|teacher)\b/i);
  return m?.[1] ?? null;
}

function countTimeOptions(hay: string): number {
  const slots =
    hay.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi) ??
    hay.match(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunedì|martedì|mercoledì|giovedì|venerdì)\b/gi);
  return slots?.length ?? 0;
}

function buildHighPrioritySummary(
  row: SituationInput,
  kinds: EmailIntentKind[],
  locale: "en" | "it",
): string | null {
  const hay = emailHaystack(row as GmailInboxRow);
  const who = senderDisplayName(row.sender);
  const child = childNameFromHaystack(hay);

  if (kinds.includes("scheduling") || detectSchedulingIntent(row as GmailInboxRow).detected) {
    if (/reschedul|riprenot|new time|nuovo orario|spostare|postpone|riprogramm/i.test(hay)) {
      return locale === "it"
        ? `${who} chiede di spostare un appuntamento — serve una nuova data.`
        : `${who} needs you to pick a new appointment time.`;
    }
    if (countTimeOptions(hay) >= 2) {
      return locale === "it"
        ? `${who} propone alcune fasce orarie — scegli quella che ti va.`
        : `${who} sent a few time options — pick what works for you.`;
    }
    return locale === "it"
      ? `${who} vuole fissare un incontro o una chiamata.`
      : `${who} is trying to schedule time with you.`;
  }

  if (kinds.includes("pricing_inquiry")) {
    const emp = hay.match(/(\d+)\s*(?:employees?|dipendenti|seats?)/i);
    return locale === "it"
      ? emp
        ? `${who} chiede un preventivo per circa ${emp[1]} persone.`
        : `${who} chiede informazioni su prezzi o piani.`
      : emp
        ? `${who} is asking about pricing for about ${emp[1]} people.`
        : `${who} is asking about pricing or plans.`;
  }

  if (kinds.includes("sales_lead")) {
    return locale === "it"
      ? `${who} mostra interesse commerciale — vale la pena rispondere.`
      : `${who} is interested in working with you — worth a reply.`;
  }

  if (/school|scuola|pickup|ritiro|classroom|insegnante|teacher|bambini|child/i.test(hay)) {
    if (/pickup|ritiro|confirm|conferm/i.test(hay)) {
      return locale === "it"
        ? child
          ? `La scuola di ${child} chiede conferma sul ritiro.`
          : `Messaggio dalla scuola — serve conferma sul ritiro.`
        : child
          ? `Aggiornamento dalla scuola di ${child}.`
          : `Aggiornamento dalla scuola.`;
    }
    return locale === "it"
      ? child
        ? `La scuola di ${child} ha scritto — potrebbe richiedere una risposta.`
        : `Messaggio scolastico da ${who}.`
      : child
        ? `${child}'s school reached out — may need a quick reply.`
        : `School message from ${who}.`;
  }

  if (/payment|billing|subscription|invoice|pagamento|abbonamento|play store|app store/i.test(hay)) {
    if (/failed|declined|couldn't|could not|non riuscito|rifiutato/i.test(hay)) {
      return locale === "it"
        ? `Problema con un pagamento o abbonamento — da verificare.`
        : `A payment or subscription didn't go through — worth checking.`;
    }
    return locale === "it"
      ? `Nota su fattura o pagamento da ${who}.`
      : `Billing or payment note from ${who}.`;
  }

  if (kinds.includes("support_request")) {
    return locale === "it"
      ? `${who} segnala un problema e chiede aiuto.`
      : `${who} reported an issue and needs help.`;
  }

  if (kinds.includes("decision_required")) {
    return locale === "it"
      ? `${who} aspetta una tua decisione o approvazione.`
      : `${who} is waiting on your decision or approval.`;
  }

  if (kinds.includes("direct_question") || kinds.includes("information_request")) {
    return locale === "it"
      ? `${who} ha una domanda diretta — probabilmente serve una risposta.`
      : `${who} asked something directly — a reply is probably expected.`;
  }

  if (kinds.includes("urgent_request") || kinds.includes("deadline")) {
    return locale === "it"
      ? `${who} segnala urgenza — conviene rispondere presto.`
      : `${who} flagged this as time-sensitive.`;
  }

  return locale === "it"
    ? `Messaggio importante da ${who}.`
    : `Important message from ${who}.`;
}

/** One calm sentence — situation, not classification. */
export function buildSituationSummary(
  row: SituationInput,
  category: InboxAiCategory,
  context: SituationContext = { category },
): string {
  const locale = context.locale ?? "en";
  const fullRow = row as GmailInboxRow;
  const hay = emailHaystack(fullRow);
  const intent = analyzeEmailIntent(fullRow);

  if (intent.highPriority) {
    const line = buildHighPrioritySummary(row, intent.kinds, locale);
    if (line) return line;
  }

  const who = senderDisplayName(row.sender);
  const topic = (row.subject ?? "")
    .replace(/^(re|fwd?|r):\s*/gi, "")
    .trim()
    .slice(0, 60);

  if (context.relationship?.kind === "school") {
    const child = childNameFromHaystack(hay);
    if (/pickup|ritiro/i.test(hay)) {
      return locale === "it"
        ? child
          ? `La scuola di ${child} chiede conferma sul ritiro.`
          : `La scuola chiede conferma sul ritiro.`
        : child
          ? `Nota dalla scuola di ${child}.`
          : `Nota dalla scuola.`;
    }
  }

  if (category === "promotion") {
    if (/instagram|tiktok|social/i.test(hay)) {
      return locale === "it"
        ? "Notifica da un social — puoi ignorarla."
        : "Social notification — safe to skip.";
    }
    return locale === "it"
      ? topic
        ? `Promozione da ${who} su «${topic}».`
        : `Promozione da ${who} — nessuna risposta necessaria.`
      : topic
        ? `${who} sent a promotion about “${topic}”.`
        : `${who} sent a promotional email — no reply needed.`;
  }

  if (category === "newsletter") {
    return locale === "it"
      ? topic
        ? `Newsletter: ${topic}.`
        : `Newsletter da ${who} — leggi quando vuoi.`
      : topic
        ? `Newsletter: ${topic}.`
        : `Newsletter from ${who} — read when you have time.`;
  }

  if (category === "handled") {
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
    return locale === "it"
      ? `Aggiornamento automatico da ${who}.`
      : `Automated update from ${who} — nothing you need to send.`;
  }

  if (category === "quick_reply") {
    return locale === "it"
      ? topic
        ? `${who} su «${topic}» — bastano poche righe di risposta.`
        : `Messaggio breve da ${who} — risposta veloce.`
      : topic
        ? `${who} about “${topic}” — a short reply should do.`
        : `Short note from ${who} — a quick reply should do.`;
  }

  if (/doctor|clinic|ospedale|appointment|visita|medico/i.test(hay)) {
    return locale === "it"
      ? `${who} — messaggio sanitario da rivedere.`
      : `${who} — health-related message to review.`;
  }

  return locale === "it"
    ? topic
      ? `${who} ha scritto riguardo «${topic}».`
      : `Messaggio da ${who} da valutare.`
    : topic
      ? `${who} wrote about “${topic}”.`
      : `Message from ${who} to review.`;
}

export function deriveIntentChips(
  row: SituationInput,
  context: SituationContext,
): string[] {
  const locale = context.locale ?? "en";
  const fullRow = row as GmailInboxRow;
  const hay = emailHaystack(fullRow);
  const intent = analyzeEmailIntent(fullRow);
  const scheduling = detectSchedulingIntent(fullRow);
  const chips: string[] = [];
  const add = (en: string, it: string) => {
    const label = locale === "it" ? it : en;
    if (!chips.includes(label)) chips.push(label);
  };

  if (context.relationship?.kind === "school") add("School", "Scuola");
  if (context.relationship?.kind === "healthcare") add("Health", "Salute");
  if (context.relationship?.kind === "family") add("Family", "Famiglia");

  if (scheduling.detected) {
    if (/reschedul|riprenot|new time|nuovo orario/i.test(hay)) add("Reschedule", "Riprenotare");
    else add("Scheduling", "Appuntamento");
    const slots = countTimeOptions(hay);
    if (slots >= 2) add(`${slots} time options`, `${slots} orari`);
  }

  if (/payment|billing|subscription|pagamento|abbonamento/i.test(hay)) {
    if (/failed|declined|non riuscito/i.test(hay)) add("Payment issue", "Problema pagamento");
    else add("Billing", "Fatturazione");
  }

  if (intent.kinds.includes("pricing_inquiry")) add("Pricing", "Prezzi");
  if (intent.kinds.includes("sales_lead")) add("Sales", "Commerciale");
  if (intent.kinds.includes("support_request")) add("Support", "Supporto");
  if (intent.kinds.includes("decision_required")) add("Needs decision", "Decisione");
  if (intent.kinds.includes("deadline") || intent.kinds.includes("urgent_request")) {
    add("Time-sensitive", "Urgenza");
  }

  if (context.replyRecommended && context.category !== "handled") {
    add("Reply recommended", "Risposta consigliata");
  } else if (context.category === "handled" || isCommercialBulk(fullRow)) {
    add("No reply needed", "Nessuna risposta");
  }

  if (/waiting|follow up|in attesa|aspett/i.test(hay)) {
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
  if (/likely needs a reply|probabilmente serve una risposta/i.test(t)) {
    return locale === "it" ? "Rispondi quando puoi." : "Reply when you can.";
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
): { summary: string; chips: string[]; nextStep: string | null } {
  const summary = buildSituationSummary(row, context.category, context);
  const chips = deriveIntentChips(row, context);
  const nextStep = polishNextStep(context.suggestedNextAction, context.locale ?? "en");
  return { summary, chips, nextStep };
}
