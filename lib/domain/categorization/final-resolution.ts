/**
 * Single source of truth for inbox category ownership.
 *
 * Hierarchy (strict):
 * 1. Per-email manual override (DB + local)
 * 2. Learned sender preference (onboarding + explicit sender feedback)
 * 3. Sender memory (trust-weighted personal learning)
 * 4. Category correction history for sender
 * 5. Persisted locked category (already resolved on server with manual/sender/memory source)
 * 6. AI / heuristic categorization
 */

import type { GmailInboxRow } from "@/lib/gmail-api";
import type { CategorySource, InboxAiCategory } from "@/lib/inbox-ai-categories";
import { isUserLockedCategorySource } from "@/lib/category-authority";
import { lookupScopedValue } from "@/lib/gmail/account-types";
import {
  lookupCorrectionHistoryCategory,
  lookupMemoryCategory,
  lookupSenderMemoryCategory,
} from "@/lib/domain/memory/apply";
import { logSenderRuleDebug, resolveSenderIdentity } from "@/lib/sender-identity";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import { applyUserRulesPre } from "@/lib/inbox-user-rules/apply";
import { safeArray } from "@/lib/safe-array";
import { toCanonicalInboxCategory } from "@/lib/domain/categorization/canonical";
import { logCategoryResolutionDebug } from "@/lib/domain/categorization/debug";

export type CategoryResolutionContext = {
  emailOverrides: Record<string, InboxAiCategory>;
  /** Learned behavioral memory — outranks sender prefs and AI after 2+ corrections. */
  memoryRules: InboxUserRule[] | null | undefined;
  senderRules: InboxUserRule[] | null | undefined;
};

function safeResolutionContext(context: CategoryResolutionContext): {
  emailOverrides: Record<string, InboxAiCategory>;
  memoryRules: InboxUserRule[];
  senderRules: InboxUserRule[];
} {
  return {
    emailOverrides: context.emailOverrides ?? {},
    memoryRules: safeArray(context.memoryRules),
    senderRules: safeArray(context.senderRules),
  };
}

export type CategoryResolutionInput = {
  row: Pick<GmailInboxRow, "id" | "sender" | "subject" | "snippet"> & {
    accountId?: string;
  };
  /** Category produced by AI/heuristics before final resolution. */
  aiCategory?: InboxAiCategory | null;
  aiSource?: CategorySource;
  /** Category already on the row from a prior pipeline step. */
  pipelineCategory?: InboxAiCategory | null;
  pipelineSource?: CategorySource;
  context: CategoryResolutionContext;
};

export type CategoryResolutionResult = {
  category: InboxAiCategory;
  source: CategorySource;
  audit: CategoryResolutionAudit;
  /** When true, AI must not run for this email. */
  skipAi: boolean;
};

export type CategoryResolutionAudit = {
  emailId: string;
  accountId?: string;
  dbCategory: InboxAiCategory | null;
  manualOverride: InboxAiCategory | null;
  memoryLearned: InboxAiCategory | null;
  correctionHistory: InboxAiCategory | null;
  senderLearned: InboxAiCategory | null;
  senderRuleLabel: string | null;
  persistedCategory: InboxAiCategory | null;
  aiCategory: InboxAiCategory | null;
  finalCategory: InboxAiCategory;
  finalSource: CategorySource;
  /** Which rule won in strict priority order. */
  winningRule:
    | "manual_override"
    | "memory_rule"
    | "correction_history"
    | "sender_rule"
    | "persisted_locked"
    | "ai"
    | "pipeline"
    | "default";
  /** When final resolution overrides an earlier pipeline/AI label. */
  overrideReason: string | null;
};

/**
 * Gmail message ids are only unique within one mailbox, so override maps are
 * keyed by `accountId:emailId` when the account is known. Raw emailId keys
 * remain supported as a legacy fallback for pre-multi-account data.
 */
export function getManualOverride(
  emailId: string,
  emailOverrides: Record<string, InboxAiCategory>,
  accountId?: string,
): InboxAiCategory | null {
  return lookupScopedValue(emailOverrides, emailId, accountId) ?? null;
}

export function getMemoryLearnedCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[] | null | undefined,
): InboxAiCategory | null {
  return lookupSenderMemoryCategory(row, memoryRules);
}

export function getCorrectionHistoryCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[] | null | undefined,
): InboxAiCategory | null {
  return lookupCorrectionHistoryCategory(row, memoryRules);
}

/** Full memory stack — sender + correction history + patterns. */
export function getAnyMemoryCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[] | null | undefined,
): InboxAiCategory | null {
  return lookupMemoryCategory(row, memoryRules);
}

export function getSenderLearnedCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  senderRules: InboxUserRule[] | null | undefined,
): InboxAiCategory | null {
  return getSenderLearnedRule(row, senderRules)?.category ?? null;
}

export function getSenderLearnedRule(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  senderRules: InboxUserRule[] | null | undefined,
): { category: InboxAiCategory; label?: string } | null {
  const senderPre = applyUserRulesPre(row as GmailInboxRow, safeArray(senderRules));
  const category =
    senderPre?.kind === "force"
      ? senderPre.category
      : senderPre?.kind === "block"
        ? "good_to_know"
        : null;

  if (
    category &&
    (process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_SENDER_RULE_DEBUG === "1")
  ) {
    logSenderRuleDebug("getSenderLearnedCategory match", {
      emailId: (row as { id?: string }).id,
      sender: row.sender,
      ...resolveSenderIdentity(row.sender),
      category,
      ruleLabel: senderPre?.label,
    });
  }

  if (!category) return null;
  return { category, label: senderPre?.label };
}

/** True when AI categorization must not run for this email. */
export function mustSkipAiCategorization(
  row: Pick<GmailInboxRow, "id" | "sender" | "subject" | "snippet"> & {
    accountId?: string;
  },
  context: CategoryResolutionContext,
): boolean {
  const safe = safeResolutionContext(context);
  if (getManualOverride(row.id, safe.emailOverrides, row.accountId)) return true;
  if (getSenderLearnedCategory(row, safe.senderRules)) return true;
  if (getAnyMemoryCategory(row, safe.memoryRules)) return true;
  return false;
}

export function resolveFinalCategory(input: CategoryResolutionInput): CategoryResolutionResult {
  const { row } = input;
  const context = safeResolutionContext(input.context);
  const manualOverride = getManualOverride(row.id, context.emailOverrides, row.accountId);
  const senderRule = getSenderLearnedRule(row, context.senderRules);
  const senderLearned = senderRule?.category ?? null;
  const memoryLearned = getMemoryLearnedCategory(row, context.memoryRules);
  const correctionHistory = getCorrectionHistoryCategory(row, context.memoryRules);
  const aiCategory = input.aiCategory ?? null;
  const persistedCategory =
    input.pipelineSource && isUserLockedCategorySource(input.pipelineSource)
      ? input.pipelineCategory ?? null
      : null;

  let finalCategory: InboxAiCategory;
  let finalSource: CategorySource;

  if (manualOverride) {
    finalCategory = manualOverride;
    finalSource = "manual_override";
  } else if (senderLearned) {
    finalCategory = senderLearned;
    finalSource = "sender_rule";
  } else if (memoryLearned) {
    finalCategory = memoryLearned;
    finalSource = "memory_rule";
  } else if (correctionHistory) {
    finalCategory = correctionHistory;
    finalSource = "memory_rule";
  } else if (persistedCategory && input.pipelineSource) {
    finalCategory = persistedCategory;
    finalSource = input.pipelineSource;
  } else if (aiCategory) {
    finalCategory = aiCategory;
    finalSource = input.aiSource ?? "ai";
  } else if (input.pipelineCategory) {
    finalCategory = input.pipelineCategory;
    finalSource = input.pipelineSource ?? "heuristic";
  } else {
    finalCategory = "worth_your_attention";
    finalSource = "heuristic";
  }

  finalCategory = toCanonicalInboxCategory(finalCategory);

  const winningRule: CategoryResolutionAudit["winningRule"] = manualOverride
    ? "manual_override"
    : senderLearned
      ? "sender_rule"
      : memoryLearned
        ? "memory_rule"
        : correctionHistory
          ? "correction_history"
          : persistedCategory && input.pipelineSource
            ? "persisted_locked"
            : aiCategory
              ? "ai"
              : input.pipelineCategory
                ? "pipeline"
                : "default";

  const pipelineCategory = input.pipelineCategory ?? aiCategory;
  const overrideReason =
    pipelineCategory &&
    pipelineCategory !== finalCategory &&
    (winningRule === "sender_rule" ||
      winningRule === "memory_rule" ||
      winningRule === "manual_override" ||
      winningRule === "correction_history")
      ? `${winningRule} overrode ${input.pipelineSource ?? "pipeline"} (${pipelineCategory} → ${finalCategory})`
      : null;

  const audit: CategoryResolutionAudit = {
    emailId: row.id,
    accountId: row.accountId,
    dbCategory: input.pipelineCategory ?? aiCategory,
    manualOverride,
    memoryLearned,
    correctionHistory,
    senderLearned,
    senderRuleLabel: senderRule?.label ?? null,
    persistedCategory,
    aiCategory,
    finalCategory,
    finalSource,
    winningRule,
    overrideReason,
  };

  logCategoryResolutionDebug(audit);

  return {
    category: finalCategory,
    source: finalSource,
    audit,
    skipAi: mustSkipAiCategorization(row, input.context),
  };
}
