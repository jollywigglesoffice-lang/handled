import type { MemoryRecord, SmartSearchFilter } from "@/lib/contextual-search/types";
import type { ContextualSearchMessage } from "@/lib/contextual-search/types";
import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import type { GmailInboxRow } from "@/lib/gmail-api";

const INVOICE = /\b(invoice|billing|receipt|fattura|pagamento|shopify|stripe)\b/i;
const URGENT = /\b(urgent|asap|important|deadline|scadenza)\b/i;
const DOCTOR = /\b(doctor|clinic|pediatric|hospital|medical|appointment|dottore)\b/i;

export function inferFiltersForMessage(
  m: ContextualSearchMessage,
  followUpState?: string,
): SmartSearchFilter[] {
  const hay = `${m.sender} ${m.subject} ${m.snippet} ${m.aiSummary ?? ""}`;
  const filters: SmartSearchFilter[] = [];

  if (
    followUpState === "conversation_unresolved" ||
    followUpState === "follow_up_recommended" ||
    followUpState === "user_commitment_pending" ||
    followUpState === "awaiting_your_reply"
  ) {
    filters.push("unresolved");
  }

  if (followUpState === "waiting_for_response") {
    filters.push("waiting_for_response");
  }

  if (URGENT.test(hay) || (m.timelineIntelligence?.escalationScore ?? 0) >= 55) {
    filters.push("urgent");
  }

  if (
    m.relationship?.kind === "school" ||
    /school|teacher|scuola|field trip|alexandria/i.test(hay)
  ) {
    filters.push("school");
  }

  if (m.relationship?.kind === "healthcare" || DOCTOR.test(hay)) {
    filters.push("doctor");
  }

  if (INVOICE.test(hay) || followUpState === "pending_payment") {
    filters.push("invoices");
  }

  if (m.category === "promotions") {
    filters.push("promotions");
  }

  return [...new Set(filters)];
}

export function recordMatchesFilter(
  record: MemoryRecord,
  filter: SmartSearchFilter,
): boolean {
  return record.filters.includes(filter);
}

export function rowFromSearchMessage(m: ContextualSearchMessage): GmailInboxRow {
  return {
    id: m.id,
    threadId: m.threadId ?? m.id,
    sender: m.sender,
    subject: m.subject,
    snippet: m.snippet,
    date: m.date ?? "",
    internalDateMs:
      m.internalDateMs ?? (m.date ? new Date(m.date).getTime() : 0),
  };
}
