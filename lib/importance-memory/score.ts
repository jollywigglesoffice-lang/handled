import type { EmailCompletionMap } from "@/lib/email-completions/types";
import { inboxCategoryLearnPriority } from "@/lib/inbox-ai-categories";
import type { ImportanceLevel, SenderImportanceMemory } from "@/lib/importance-memory/types";
import { getSenderEmailOpenCount } from "@/lib/importance-memory/sender-opens";
import { senderLinesMatch } from "@/lib/relationship-memory/match-sender";
import { loadClientMemoryState } from "@/lib/memory-engine/client-cache";
import { loadSenderCorrectionLearning } from "@/lib/sender-correction-learning";
import { resolveSenderIdentity } from "@/lib/sender-identity";

const SHOW_MIN_EVENTS = 3;
const SHOW_MIN_SCORE = 8;

function categoryScoreDelta(category: string, count: number): number {
  const pri = inboxCategoryLearnPriority(category);
  if (pri >= 5) return count * 3;
  if (pri <= 2) return count * -3;
  return 0;
}

function actionScoreDelta(actionId: string): number {
  if (actionId === "waiting_on_someone") return 5;
  if (actionId === "no_action_needed") return -5;
  if (actionId === "replied" || actionId === "took_action") return 1;
  return 0;
}

export function computeSenderImportanceScore(input: {
  senderLine: string;
  completions: EmailCompletionMap;
  senderOpenCount?: number;
}): { score: number; eventCount: number } {
  const { senderLine, completions } = input;
  const senderOpenCount = input.senderOpenCount ?? getSenderEmailOpenCount(senderLine);
  const ruleKey = resolveSenderIdentity(senderLine).ruleKey;

  let score = 0;
  let eventCount = 0;

  const identity = resolveSenderIdentity(senderLine);
  const memory = loadClientMemoryState();
  const senderMem = memory.senderMemory.find(
    (m) =>
      (identity.email && m.senderEmail === identity.email) ||
      (identity.domain && m.senderDomain === identity.domain),
  );
  if (senderMem) {
    eventCount += senderMem.correctionCount;
    score += categoryScoreDelta(senderMem.preferredCategory, senderMem.correctionCount);
    if (senderMem.preferredCategory === "worth_your_attention") {
      score += senderMem.correctionCount * 2;
    }
  }

  const correctionHist = memory.categoryCorrections.find(
    (c) =>
      (identity.email && c.senderEmail === identity.email) ||
      (identity.domain && c.senderDomain === identity.domain),
  );
  if (correctionHist) {
    if (correctionHist.userCategory === "worth_your_attention") {
      score += correctionHist.correctionCount * 4;
      eventCount += correctionHist.correctionCount;
    }
    score += categoryScoreDelta(correctionHist.userCategory, correctionHist.correctionCount);
  }

  // Legacy localStorage learning — merged until fully migrated
  const correction = loadSenderCorrectionLearning().find((r) => r.senderKey === ruleKey);
  if (correction) {
    if (correction.correctionsToNeedsAttention > 0) {
      score += correction.correctionsToNeedsAttention * 4;
      eventCount += correction.correctionsToNeedsAttention;
    }
    for (const [category, count] of Object.entries(correction.categoryCounts ?? {})) {
      if (!count) continue;
      eventCount += count;
      score += categoryScoreDelta(category, count);
    }
  }

  const senderRecords = Object.values(completions).filter((r) =>
    senderLinesMatch(r.sender, senderLine),
  );

  for (const record of senderRecords) {
    eventCount += 1;
    score += actionScoreDelta(record.actionId);
    score += categoryScoreDelta(record.category, 1);
    if (record.waitingResolutionReason === "received_response") {
      score += 2;
    }
    if (record.waitingResponseDetectedAt) {
      score += 2;
      eventCount += 1;
    }
  }

  if (senderOpenCount >= 3) {
    score += 2;
    eventCount += 1;
  }

  return { score, eventCount };
}

function importanceLabel(level: ImportanceLevel, locale: "en" | "it"): string {
  if (locale === "it") {
    return level === "important" ? "Di solito importante" : "Di solito bassa priorità";
  }
  return level === "important" ? "Usually important" : "Usually low priority";
}

export function buildSenderImportanceMemory(input: {
  senderLine: string;
  completions: EmailCompletionMap;
  locale: "en" | "it";
  senderOpenCount?: number;
}): SenderImportanceMemory | null {
  const { score, eventCount } = computeSenderImportanceScore(input);
  if (eventCount < SHOW_MIN_EVENTS) return null;

  if (score >= SHOW_MIN_SCORE) {
    return { level: "important", label: importanceLabel("important", input.locale) };
  }
  if (score <= -SHOW_MIN_SCORE) {
    return { level: "low_priority", label: importanceLabel("low_priority", input.locale) };
  }

  return null;
}

/** Tiebreaker boost for inbox ordering — never changes categories. */
export function importanceInboxBoost(input: {
  senderLine: string;
  completions: EmailCompletionMap;
}): number {
  const memory = buildSenderImportanceMemory({ ...input, locale: "en" });
  if (!memory) return 0;
  return memory.level === "important" ? 1 : -1;
}
