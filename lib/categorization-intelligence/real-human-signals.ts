import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  detectPrioritySignals,
  emailHaystack,
  type PrioritySignalHit,
} from "@/lib/categorization-intelligence/priority-signals";
import {
  detectPromotionalSignals,
  isMarketingStyleQuestion,
  type PromotionalAnalysis,
} from "@/lib/categorization-intelligence/promotional-signals";

const REAL_HUMAN_CODES = new Set([
  "school_context",
  "school_name",
  "school_domain",
  "school_student_context",
  "family_context",
  "healthcare_context",
  "scheduling_change",
  "invoice_personal",
]);

const HUMAN_SCHEDULING_ASK =
  /\b(can you confirm|could you confirm|please confirm|confirm (?:the )?pickup|pickup time|drop.?off time|school pickup|orario di ritiro|confermi (?:l[''])?orario|puoi confermare|riesci a confermare|when can you pick|what time (?:works|should))\b/i;

const HUMAN_DIRECT_ASK =
  /\b(could you (?:let me know|send|review)|can you (?:let me know|send|review|confirm)|would you (?:mind|be able)|need you to|waiting for your (?:reply|response)|per favore (?:conferma|rispondi)|ti chiedo di|fammi sapere se)\b/i;

const AUTOMATED_SENDER =
  /noreply|no-reply|donotreply|notifications?@|newsletter|marketing@|mailer-daemon/i;

export type RealHumanAnalysis = {
  score: number;
  hits: PrioritySignalHit[];
  hasHardPersonalBlock: boolean;
  hasHumanQuestion: boolean;
  hasHumanRequest: boolean;
};

/**
 * Genuine human / school / family signals — excludes bare marketing "urgency" words.
 */
export function detectRealHumanSignals(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  promo?: PromotionalAnalysis,
): RealHumanAnalysis {
  const hay = emailHaystack(row);
  const sender = row.sender.toLowerCase();
  const p = promo ?? detectPromotionalSignals(row);
  const allHits = detectPrioritySignals(row);

  const hits = allHits.filter((h) => {
    if (REAL_HUMAN_CODES.has(h.code)) return true;
    if (h.code === "scheduling_intent" || h.code === "scheduling_change") {
      return HUMAN_SCHEDULING_ASK.test(hay) || HUMAN_DIRECT_ASK.test(hay);
    }
    if (h.code === "question_detected") {
      return !isMarketingStyleQuestion(row, p);
    }
    if (h.code === "request_detected") {
      return HUMAN_DIRECT_ASK.test(hay) || HUMAN_SCHEDULING_ASK.test(hay);
    }
    if (h.code === "italian_urgency" || h.code === "english_urgency" || h.code === "deadline") {
      return false;
    }
    if (h.code === "meeting_request") {
      return !p.isBulkMarketing && (HUMAN_DIRECT_ASK.test(hay) || !AUTOMATED_SENDER.test(sender));
    }
    if (h.code === "work_management") {
      return !AUTOMATED_SENDER.test(sender) && p.score < 35;
    }
    if (h.code === "personal_sender") {
      return p.score < 40;
    }
    return false;
  });

  if (HUMAN_SCHEDULING_ASK.test(hay) && !hits.some((h) => h.code === "scheduling_intent")) {
    hits.push({
      code: "human_scheduling_ask",
      label: "Human scheduling confirmation request",
      weight: 28,
    });
  }
  if (HUMAN_DIRECT_ASK.test(hay) && !hits.some((h) => h.code === "request_detected")) {
    hits.push({
      code: "human_direct_ask",
      label: "Direct human request detected",
      weight: 24,
    });
  }

  const hasHardPersonalBlock = hits.some((h) =>
    [
      "school_context",
      "school_name",
      "school_domain",
      "school_student_context",
      "family_context",
      "healthcare_context",
      "scheduling_change",
      "invoice_personal",
      "human_scheduling_ask",
    ].includes(h.code),
  );

  const hasHumanQuestion =
    hits.some((h) => h.code === "question_detected") ||
    (/\?/.test(hay) && HUMAN_SCHEDULING_ASK.test(hay));

  const hasHumanRequest =
    hits.some((h) =>
      ["request_detected", "human_direct_ask", "human_scheduling_ask", "scheduling_change"].includes(
        h.code,
      ),
    );

  let score = hits.reduce((sum, h) => sum + h.weight, 0);
  if (hasHardPersonalBlock) score = Math.max(score, 32);

  return {
    score: Math.min(100, score),
    hits,
    hasHardPersonalBlock,
    hasHumanQuestion,
    hasHumanRequest,
  };
}
