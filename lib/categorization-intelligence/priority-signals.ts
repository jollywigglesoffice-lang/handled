import type { GmailInboxRow } from "@/lib/gmail-api";

export type PrioritySignalHit = {
  code: string;
  label: string;
  weight: number;
};

import { parseSenderDomain } from "@/lib/inbox-user-rules/match";

export function emailText(row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">): string {
  return `${row.sender}\n${row.subject}\n${row.snippet ?? ""}`;
}

export function emailHaystack(row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">): string {
  return emailText(row).toLowerCase();
}

const SCHOOL_EN =
  /\b(school|schools|teacher|teachers|principal|headmaster|pta|parent.?teacher|parent conference|report card|grade|grades|homework|field trip|permission slip|absence|tardy|pickup|drop.?off|school district|classroom|kindergarten|elementary|middle school|high school|nursery|daycare|childcare)\b/i;

const SCHOOL_IT =
  /\b(scuola|scuole|scuol[aà]|istituto|istituti|collegio|asilo|nido|materna|elementare|media|superiore|insegnante|insegnanti|maestra|maestro|professoressa|professore|dirigente|segreteria|segreteria\s+scolastica|colloquio|colloqui|genitori|classe|classi|compiti|votazione|permesso|assenze?|circolo\s+didattico|istituto\s+comprensivo|docente|registro|elettronico)\b/i;

/** Proper-noun / branded school names (e.g. Scuola Alexandria). */
const SCHOOL_NAME_HINTS =
  /\b(alexandria|montessori|waldorf|reggio|cambridge|international\s+school|british\s+school|american\s+school)\b/i;

const SCHOOL_DOMAIN_KEYWORDS =
  /^(?:.*\.)?(scuola|school|schools|istituto|collegio|asilo|nido|edu|university|uni-[a-z0-9-]+|[a-z0-9-]*school[a-z0-9-]*)$/i;

function isSchoolSenderDomain(sender: string): boolean {
  const domain = parseSenderDomain(sender)?.toLowerCase() ?? "";
  if (!domain) return false;
  if (domain.endsWith(".edu")) return true;
  return SCHOOL_DOMAIN_KEYWORDS.test(domain);
}

const FAMILY =
  /\b(family|famiglia|mamma|pap[aà]|papa|mom|dad|mother|father|nonna|nonno|grandma|grandpa|figlio|figlia|son|daughter|child|children|kids|bambin[oi]|marito|moglie|spouse|partner|zii?|cugin[oi])\b/i;

const HEALTHCARE =
  /\b(doctor|dr\.|physician|pediatric|pediatra|pediatria|hospital|ospedale|clinic|clinica|medical|medico|dentist|dentista|appointment|appuntamento|prescription|ricetta|lab results|esami|vaccin|therapy|terapia|urgent care|pronto\s+soccorso)\b/i;

const SCHEDULING =
  /\b(meeting|meetings|riunione|riunioni|appuntamento|appuntamenti|schedule|scheduling|calendar|calendario|conferma|confermare|confirm|confirmation|slot|availability|disponibil|when can you|possiamo|ci incontriamo|call at|video call|zoom|teams|google meet)\b/i;

const SCHEDULING_CHANGE =
  /\b(reschedule|postpone|spostare|spostato|modifica\s+(orario|data)|cambio\s+(orario|data)|change of (time|date)|new time|nuovo\s+orario|annullato|cancelled|canceled|moved to)\b/i;

const DEADLINE =
  /\b(deadline|scadenza|due by|due on|entro|by (?:eod|tomorrow|friday|monday|tomorrow)|asap|urgent|urgente|urgentissim[oa]|time.?sensitive|entro\s+(?:le|il)|ultimo\s+giorno)\b/i;

const REQUEST_IT =
  /\b(richiesta|per favore|potresti|puoi|vorrei|avrei bisogno|ti chiedo|confermi|confermare|rispondi|rispondere|fammi sapere)\b/i;

const REQUEST_EN =
  /\b(please (?:confirm|review|reply|respond|let me know)|could you|can you|would you|need you to|waiting for your|follow(?:ing)? up|action required|need your)\b/i;

const WORK_MANAGEMENT =
  /\b(manager|director|ceo|hr@|project|deadline|deliverable|standup|stand-up|sprint|jira|asana|linear|notion|slack|approval|sign.?off|stakeholder|client meeting|board meeting)\b/i;

const INVOICE_PAYMENT =
  /\b(invoice|fattura|receipt|ricevuta|payment|pagamento|pagare|amount due|importo|scadenza pagamento|tuition|retta|contributo|iscrizione|fee|fees|bolletta|bollette|charged|addebito)\b/i;

const PERSONAL_SENDER_NAME = /^["']?[A-Za-zÀ-ÿ][\w.'-]*(?:\s+[A-Za-zÀ-ÿ][\w.'-]*)+["']?\s*</;

const AUTOMATED_SENDER =
  /noreply|no-reply|donotreply|notifications?@|newsletter|marketing@|mailer-daemon/i;

export function detectPrioritySignals(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): PrioritySignalHit[] {
  const hay = emailHaystack(row);
  const sender = row.sender.toLowerCase();
  const hits: PrioritySignalHit[] = [];

  const add = (code: string, label: string, weight: number) => {
    hits.push({ code, label, weight });
  };

  if (SCHOOL_EN.test(hay) || SCHOOL_IT.test(hay)) {
    add("school_context", "School context detected", 28);
  }
  if (SCHOOL_NAME_HINTS.test(hay)) {
    add("school_name", "School name or branded campus detected", 22);
  }
  if (isSchoolSenderDomain(row.sender)) {
    add("school_domain", "School or edu sender domain", 26);
  }
  if (/\b(seba|sebastian|alexandria)\b/i.test(hay) && (SCHOOL_IT.test(hay) || SCHOOL_EN.test(hay) || SCHOOL_NAME_HINTS.test(hay))) {
    add("school_student_context", "Student name with school context", 30);
  }

  if (FAMILY.test(hay)) {
    add("family_context", "Family contact context", 24);
  }
  if (HEALTHCARE.test(hay)) {
    add("healthcare_context", "Healthcare context detected", 26);
  }
  if (SCHEDULING_CHANGE.test(hay)) {
    add("scheduling_change", "Scheduling change detected", 24);
  }
  if (SCHEDULING.test(hay)) {
    add("scheduling_intent", "Scheduling intent detected", 20);
  }
  if (DEADLINE.test(hay)) {
    add("deadline", "Deadline or urgency detected", 22);
  }

  const qCount = (hay.match(/\?/g) ?? []).length;
  if (qCount > 0) {
    add("question_detected", qCount > 1 ? "Multiple questions detected" : "Question detected", 16 + Math.min(qCount, 3) * 4);
  }
  if (REQUEST_IT.test(hay) || REQUEST_EN.test(hay)) {
    add("request_detected", "Request for action detected", 18);
  }
  if (WORK_MANAGEMENT.test(hay) && !AUTOMATED_SENDER.test(sender)) {
    add("work_management", "Work management signal", 16);
  }
  if (/\b(meeting|riunione|call|zoom|teams)\b/i.test(hay)) {
    add("meeting_request", "Meeting request detected", 14);
  }

  if (INVOICE_PAYMENT.test(hay) && (SCHOOL_EN.test(hay) || SCHOOL_IT.test(hay) || FAMILY.test(hay) || HEALTHCARE.test(hay))) {
    add("invoice_personal", "Payment in personal/school/health context", 20);
  }

  if (/\b(urgente|urgentissim[oa])\b/i.test(hay)) {
    add("italian_urgency", "Italian urgency wording detected", 24);
  }
  if (/\b(urgent|asap|time.?sensitive|immediate(?:ly)?)\b/i.test(hay)) {
    add("english_urgency", "English urgency wording detected", 20);
  }

  if (PERSONAL_SENDER_NAME.test(row.sender) && !AUTOMATED_SENDER.test(sender)) {
    add("personal_sender", "Personal name sender (not automated)", 10);
  }

  return hits;
}

export function isPersonalPriorityContext(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): boolean {
  return detectPrioritySignals(row).some((h) =>
    [
      "school_context",
      "school_name",
      "school_domain",
      "school_student_context",
      "family_context",
      "healthcare_context",
      "scheduling_change",
      "invoice_personal",
    ].includes(h.code),
  );
}

export function hasMultilingualImportanceSignal(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): boolean {
  return isPersonalPriorityContext(row);
}

export function countQuestions(hay: string): number {
  return (hay.match(/\?/g) ?? []).length;
}
