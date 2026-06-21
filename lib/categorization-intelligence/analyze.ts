import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { emailHaystack } from "@/lib/categorization-intelligence/priority-signals";
import { applySenderMemory } from "@/lib/categorization-intelligence/sender-memory";
import {
  detectPromotionalSignals,
  isMarketingStyleQuestion,
  isPromotionalDominant,
} from "@/lib/categorization-intelligence/promotional-signals";
import { detectRealHumanSignals } from "@/lib/categorization-intelligence/real-human-signals";
import type {
  CategorizationIntelligenceOptions,
  CategorizationIntelligenceResult,
  CategorizationReasonCode,
} from "@/lib/categorization-intelligence/types";

const AUTOMATED_SENDER =
  /noreply|no-reply|donotreply|notifications?@|newsletter|marketing@|mailer-daemon/i;

const REAL_HUMAN_CODE_MAP: Record<string, CategorizationReasonCode> = {
  school_context: "school_context",
  school_name: "school_context",
  school_domain: "school_context",
  school_student_context: "school_context",
  family_context: "family_context",
  healthcare_context: "healthcare_context",
  scheduling_intent: "scheduling_intent",
  scheduling_change: "scheduling_change",
  question_detected: "question_detected",
  request_detected: "request_detected",
  human_scheduling_ask: "scheduling_intent",
  human_direct_ask: "request_detected",
  invoice_personal: "invoice_in_personal_context",
  work_management: "work_management",
  meeting_request: "meeting_request",
  personal_sender: "personal_name_sender",
};

/**
 * Weighted categorization: real human/school signals beat marketing urgency.
 * Safety-first for genuine personal mail; filter promotional false positives.
 */
export function analyzeCategorizationIntelligence(
  row: GmailInboxRow,
  options?: CategorizationIntelligenceOptions,
): CategorizationIntelligenceResult {
  const hay = emailHaystack(row);
  const sender = row.sender.toLowerCase();
  const promo = detectPromotionalSignals(row);
  const real = detectRealHumanSignals(row, promo);
  const memory = applySenderMemory(row, options?.senderRules ?? [], {
    kind: options?.relationshipKind,
    importance: options?.relationshipImportance,
  });

  const reasonCodes: CategorizationReasonCode[] = [...memory.reasonCodes];
  const reasonLabels: string[] = [...memory.reasonLabels];

  for (const hit of real.hits) {
    const code = REAL_HUMAN_CODE_MAP[hit.code];
    if (code && !reasonCodes.includes(code)) reasonCodes.push(code);
    if (!reasonLabels.includes(hit.label)) reasonLabels.push(hit.label);
  }

  if (promo.score >= 28) {
    reasonCodes.push("promotional_bulk");
    reasonLabels.push(`Promotional signals (${promo.score})`);
    if (promo.isNewsletterStyle) {
      reasonCodes.push("newsletter_detected");
      reasonLabels.push("Newsletter-style bulk mail");
    }
  }

  let realHumanScore = real.score + memory.boost - memory.penalty;
  let promotionalScore = promo.score;
  realHumanScore = Math.max(0, Math.min(100, realHumanScore));
  promotionalScore = Math.max(0, Math.min(100, promotionalScore));

  const promotionalDominant = isPromotionalDominant(row, realHumanScore);
  const isAutomated = AUTOMATED_SENDER.test(sender);
  const isPersonalHuman =
    !isAutomated && /^["']?[A-Za-zÀ-ÿ]/.test(row.sender.trim()) && promo.score < 35;

  const hasHardPersonalBlock =
    real.hasHardPersonalBlock ||
    reasonCodes.some((c) =>
      ["relationship_school", "relationship_family", "relationship_healthcare"].includes(c),
    );

  const marketingQuestion = isMarketingStyleQuestion(row, promo);
  if (marketingQuestion && promo.hasMarketingUrgency) {
    reasonCodes.push("marketing_urgency_filtered");
    reasonLabels.push("Marketing urgency filtered (not human request)");
    realHumanScore = Math.max(0, realHumanScore - 20);
  }

  const mixedSignals = hasHardPersonalBlock && promotionalScore >= 24;
  if (mixedSignals) {
    reasonCodes.push("mixed_signals");
    reasonLabels.push("Mixed personal and promotional signals");
  }

  let suggestedCategory: InboxAiCategory = "worth_your_attention";

  if (promotionalDominant && !hasHardPersonalBlock) {
    suggestedCategory = promo.suggestedCategory;
  } else if (real.hasHumanRequest || real.hasHumanQuestion) {
    suggestedCategory = "worth_your_attention";
  } else if (memory.suggestedCategory && hasHardPersonalBlock) {
    suggestedCategory = memory.suggestedCategory;
  }

  let forcePromotional = promotionalDominant && !hasHardPersonalBlock && promotionalScore >= 28;
  let blockLowPriorityCategories = hasHardPersonalBlock;
  let forceNeedsAttention =
    hasHardPersonalBlock ||
    (realHumanScore >= 38 && !promotionalDominant) ||
    (real.hasHumanRequest && !promotionalDominant) ||
    (real.hasHumanQuestion && isPersonalHuman && !marketingQuestion && !promotionalDominant);

  if (forcePromotional) {
    forceNeedsAttention = false;
    blockLowPriorityCategories = false;
  }

  if (!forcePromotional && !hasHardPersonalBlock && realHumanScore < 28 && promotionalScore < 28) {
    if (isPersonalHuman && /\?/.test(hay) && !marketingQuestion) {
      reasonCodes.push("ambiguous_unknown_sender");
      reasonLabels.push("Unknown sender asking questions");
      forceNeedsAttention = true;
      blockLowPriorityCategories = false;
    }
  }

  if (forceNeedsAttention && !forcePromotional && suggestedCategory === "good_to_know") {
    suggestedCategory = "worth_your_attention";
    reasonCodes.push("safety_worth_your_attention");
    reasonLabels.push("Safety rule: prefer Needs Attention when uncertain");
  }

  let confidence = 0.52 + Math.min(0.4, realHumanScore / 120);
  if (forcePromotional) {
    confidence = 0.62 + Math.min(0.3, promotionalScore / 150);
  }
  if (mixedSignals) confidence = Math.min(confidence, 0.58);
  if (marketingQuestion && promotionalScore >= 30) confidence = Math.min(confidence, 0.55);
  if (hasHardPersonalBlock && realHumanScore >= 35) confidence = Math.max(confidence, 0.82);
  if (memory.boost >= 18 && hasHardPersonalBlock) confidence = Math.max(confidence, 0.88);

  confidence = Math.round(Math.max(0.4, Math.min(0.96, confidence)) * 100) / 100;

  return {
    suggestedCategory,
    confidence,
    priorityScore: realHumanScore,
    promotionalScore,
    realHumanScore,
    reasonCodes,
    reasonLabels,
    blockLowPriorityCategories,
    forceNeedsAttention,
    forcePromotional,
  };
}

export function mustNotAutoHandle(
  row: GmailInboxRow,
  options?: CategorizationIntelligenceOptions,
): boolean {
  const result = analyzeCategorizationIntelligence(row, options);
  if (result.forcePromotional) return false;
  return result.blockLowPriorityCategories;
}
