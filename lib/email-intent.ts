import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

function emailHaystack(row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">): string {
  return `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
}

export type EmailIntentKind =
  | "pricing_inquiry"
  | "sales_lead"
  | "partnership"
  | "support_request"
  | "scheduling"
  | "direct_question"
  | "decision_required"
  | "deadline"
  | "information_request";

export type EmailIntentAnalysis = {
  /** Overrides promo/newsletter/handled heuristics */
  highPriority: boolean;
  requiresReply: boolean;
  kinds: EmailIntentKind[];
  reasons: string[];
  confidence: number;
  suggestedCategory: InboxAiCategory;
  opportunityHint?: string;
};

const PRICING =
  /corporate pricing|pricing plan|price per|per seat|per user|cost per|how much (?:does|would|is)|do you have (?:a |any )?(?:corporate |team |enterprise )?(?:pricing|plan)|what (?:are|is) your (?:pricing|plans)|quote for|pricing for|\d+\s*(?:employees|seats|users)|employee count|team of \d+/i;

const SALES_LEAD =
  /early access|become (?:an? )?(?:early access )?client|become a customer|interested in (?:becoming|your|a)|business opportunity|inbound (?:lead|inquiry)|would like to (?:buy|purchase|subscribe|sign up)|sales inquiry|demo request|book a (?:demo|call)|talk to (?:sales|someone)|purchase intent|lead from/i;

const PARTNERSHIP =
  /partnership (?:inquiry|opportunity|proposal)|collaborat(?:e|ion)|work together|integrat(?:e|ion) with/i;

const SUPPORT =
  /(?:help|issue|problem|bug|error|broken|not working) with|support (?:request|ticket)|need assistance|can't (?:log in|access)|trouble with/i;

const SCHEDULING =
  /schedule (?:a |the )?(?:call|meeting|time)|book (?:a )?(?:time|slot|meeting)|calendar invite|when are you (?:free|available)|meet (?:this|next) week|set up a call/i;

const DECISION =
  /please (?:confirm|approve|review|sign)|need your (?:approval|signature|decision|input)|action required|waiting for your (?:response|reply|decision)|requires? your (?:attention|approval)/i;

const DEADLINE =
  /by (?:eod|cob|tomorrow|friday|monday|end of (?:day|week))|deadline|urgent|asap|time.?sensitive|due (?:by|on)/i;

const INFO_REQUEST =
  /could you (?:send|share|let me know)|can you (?:send|share|tell|provide)|would you (?:mind|be able)|let me know (?:if|when|what)|send (?:me )?(?:the|your)|share (?:the|your)|more (?:info|information|details) about|i(?:'d| would) like to (?:know|learn|understand)/i;

const QUESTION_MARK = /\?/;

const MULTI_QUESTION = /(?:\?|do you|can you|would you|could you|how do|what is|when is|where is)/gi;

/** Inbound sales/pricing — NOT vendor billing receipts */
export function isInboundBusinessInquiry(row: GmailInboxRow): boolean {
  const hay = emailHaystack(row);
  const hasBusinessAsk =
    PRICING.test(hay) ||
    SALES_LEAD.test(hay) ||
    PARTNERSHIP.test(hay) ||
    (INFO_REQUEST.test(hay) && QUESTION_MARK.test(hay));
  const hasHumanAsk =
    QUESTION_MARK.test(hay) ||
    /do you have|can you|would you|could you|i'd like|we'd like|interested in/i.test(hay);
  return hasBusinessAsk && (hasHumanAsk || SALES_LEAD.test(hay) || PRICING.test(hay));
}

function countQuestions(hay: string): number {
  const marks = hay.match(/\?/g);
  return marks?.length ?? 0;
}

/**
 * Intent layer — runs BEFORE bulk/newsletter/handled heuristics.
 * Principle: never miss something important.
 */
export function analyzeEmailIntent(row: GmailInboxRow): EmailIntentAnalysis {
  const hay = emailHaystack(row);
  const kinds: EmailIntentKind[] = [];
  const reasons: string[] = [];
  let confidence = 0.5;

  if (PRICING.test(hay)) {
    kinds.push("pricing_inquiry");
    reasons.push("pricing_inquiry");
    confidence = Math.max(confidence, 0.92);
  }
  if (SALES_LEAD.test(hay)) {
    kinds.push("sales_lead");
    reasons.push("sales_lead");
    confidence = Math.max(confidence, 0.9);
  }
  if (PARTNERSHIP.test(hay)) {
    kinds.push("partnership");
    reasons.push("partnership");
    confidence = Math.max(confidence, 0.88);
  }
  if (SUPPORT.test(hay)) {
    kinds.push("support_request");
    reasons.push("support_request");
    confidence = Math.max(confidence, 0.86);
  }
  if (SCHEDULING.test(hay)) {
    kinds.push("scheduling");
    reasons.push("scheduling");
    confidence = Math.max(confidence, 0.85);
  }
  if (DECISION.test(hay)) {
    kinds.push("decision_required");
    reasons.push("decision_required");
    confidence = Math.max(confidence, 0.87);
  }
  if (DEADLINE.test(hay)) {
    kinds.push("deadline");
    reasons.push("deadline");
    confidence = Math.max(confidence, 0.84);
  }
  if (INFO_REQUEST.test(hay)) {
    kinds.push("information_request");
    reasons.push("information_request");
    confidence = Math.max(confidence, 0.8);
  }

  const qCount = countQuestions(hay);
  if (qCount > 0) {
    kinds.push("direct_question");
    reasons.push(`questions:${qCount}`);
    confidence = Math.max(confidence, 0.75 + Math.min(0.15, qCount * 0.05));
  }

  const highPriority =
    kinds.length > 0 &&
    (kinds.some((k) =>
      [
        "pricing_inquiry",
        "sales_lead",
        "partnership",
        "support_request",
        "scheduling",
        "decision_required",
        "deadline",
      ].includes(k),
    ) ||
      (kinds.includes("direct_question") && qCount >= 1 && !isLikelyAutomatedFyi(hay)));

  const requiresReply =
    highPriority &&
    (kinds.includes("pricing_inquiry") ||
      kinds.includes("sales_lead") ||
      kinds.includes("direct_question") ||
      kinds.includes("support_request") ||
      kinds.includes("scheduling") ||
      kinds.includes("decision_required") ||
      kinds.includes("information_request") ||
      kinds.includes("partnership"));

  let suggestedCategory: InboxAiCategory = "needs_attention";
  if (
    kinds.includes("direct_question") &&
    qCount <= 1 &&
    hay.length < 350 &&
    !kinds.includes("pricing_inquiry") &&
    !kinds.includes("sales_lead")
  ) {
    suggestedCategory = "quick_reply";
  }

  let opportunityHint: string | undefined;
  if (kinds.includes("sales_lead") || kinds.includes("pricing_inquiry")) {
    opportunityHint = "Potential business opportunity — reply recommended.";
  }

  return {
    highPriority,
    requiresReply,
    kinds,
    reasons,
    confidence,
    suggestedCategory,
    opportunityHint,
  };
}

/** Automated FYI copy without human ask — safe to ignore for intent */
function isLikelyAutomatedFyi(hay: string): boolean {
  if (/unsubscribe|view in browser|noreply|no-reply|order confirmed|tracking number|receipt for|payment received/i.test(hay)) {
    return !/do you have|can you|would you|i'd like|interested in becoming|\?/.test(hay);
  }
  return false;
}

export function hasHighPriorityIntent(row: GmailInboxRow): boolean {
  return analyzeEmailIntent(row).highPriority;
}

export function requiresHumanReply(row: GmailInboxRow): boolean {
  return analyzeEmailIntent(row).requiresReply;
}

/** Upgrade unsafe categories when intent demands attention */
export function applyIntentToCategory(
  row: GmailInboxRow,
  category: InboxAiCategory,
): InboxAiCategory {
  const intent = analyzeEmailIntent(row);
  if (!intent.highPriority) {
    return category;
  }
  if (
    category === "handled" ||
    category === "promotion" ||
    category === "newsletter"
  ) {
    return intent.suggestedCategory;
  }
  if (category === "quick_reply" && intent.suggestedCategory === "needs_attention") {
    if (intent.kinds.includes("pricing_inquiry") || intent.kinds.includes("sales_lead")) {
      return "needs_attention";
    }
  }
  return category;
}

/** Low confidence → bias toward needs_attention (never miss important mail) */
export function safetyCategoryWhenUncertain(
  row: GmailInboxRow,
  category: InboxAiCategory,
  confidence: number,
): InboxAiCategory {
  if (confidence >= 0.72) {
    return applyIntentToCategory(row, category);
  }
  if (hasHighPriorityIntent(row)) {
    return analyzeEmailIntent(row).suggestedCategory;
  }
  if (category === "handled" && confidence < 0.65) {
    if (looksLikePossibleHumanEmail(row)) {
      return "needs_attention";
    }
  }
  return applyIntentToCategory(row, category);
}

function looksLikePossibleHumanEmail(row: GmailInboxRow): boolean {
  const hay = emailHaystack(row);
  if (isLikelyAutomatedFyi(hay)) return false;
  if (QUESTION_MARK.test(hay)) return true;
  if (/^[A-Za-z].{1,40}</.test(row.sender) && !/noreply|no-reply|notification/i.test(row.sender)) {
    return true;
  }
  return false;
}

export function intentSummaryLine(row: GmailInboxRow): string | null {
  const intent = analyzeEmailIntent(row);
  if (!intent.highPriority) return null;

  const hay = emailHaystack(row);
  if (intent.kinds.includes("pricing_inquiry")) {
    const emp = hay.match(/(\d+)\s*employees?/i);
    if (emp) {
      return `Potential customer asking about corporate pricing (${emp[1]} employees). Reply recommended.`;
    }
    return "Potential customer asking about pricing or plans. Reply recommended.";
  }
  if (intent.kinds.includes("sales_lead")) {
    return "Inbound sales or early-access interest. Treat as a business opportunity.";
  }
  if (intent.kinds.includes("scheduling")) {
    return "Meeting or scheduling request. Likely needs a reply.";
  }
  if (intent.kinds.includes("support_request")) {
    return "Support or help request. Review and respond.";
  }
  if (intent.kinds.includes("direct_question")) {
    return "Contains direct questions. A reply is likely expected.";
  }
  if (intent.kinds.includes("decision_required")) {
    return "Asks for your decision or approval.";
  }
  return "Important message that may need your response.";
}
