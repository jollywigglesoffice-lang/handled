import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type PersonalImportanceResult = {
  important: boolean;
  suggestedCategory: InboxAiCategory;
  confidence: number;
  reasons: string[];
};

/** Italian + English signals for personal / school / health / scheduling importance. */
const IT_EN_IMPORTANCE =
  /\b(scuola|scuole|insegnante|insegnanti|maestra|maestro|professoressa|professore|colloquio|colloqui|genitori|mamma|papà|papa|mamme|pediatra|pediatria|ospedale|ospedali|appuntamento|appuntamenti|riunione|riunioni|urgente|urgentissim[oa]|conferma|confermare|pagamento|pagamenti|bolletta|bollette|votazione|permesso|assenze?|compiti|classe|asilo|nido|materna|elementare|media|superiore|dirigente|segreteria|segreteria\s+scolastica)\b/i;

const EN_IMPORTANCE =
  /\b(school|teacher|parent.?teacher|pta|conference|parent conference|pediatric|hospital|appointment|urgent|confirm|confirmation|payment due|meeting|deadline|absence|permission slip|field trip|report card|grade)\b/i;

const SCHEDULING_URGENCY =
  /\b(colloquio|appuntamento|riunione|conference|meeting|schedule|when can you|please confirm|confermare|conferma entro)\b/i;

export function emailHaystackForImportance(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): string {
  return `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
}

/**
 * Detect culturally important personal mail (EN/IT/mixed inboxes).
 * Biases strongly toward needs_attention — false positives are safer than missed school/health mail.
 */
export function detectPersonalImportance(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): PersonalImportanceResult {
  const hay = emailHaystackForImportance(row);
  const reasons: string[] = [];

  if (IT_EN_IMPORTANCE.test(hay)) {
    reasons.push("multilingual_importance_keyword");
  }
  if (EN_IMPORTANCE.test(hay)) {
    reasons.push("english_importance_keyword");
  }
  if (SCHEDULING_URGENCY.test(hay)) {
    reasons.push("scheduling_urgency");
  }

  const important = reasons.length > 0;
  const confidence = Math.min(0.96, 0.72 + reasons.length * 0.08);

  return {
    important,
    suggestedCategory: important ? "needs_attention" : "handled",
    confidence,
    reasons,
  };
}

export function hasMultilingualImportanceSignal(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): boolean {
  return detectPersonalImportance(row).important;
}
