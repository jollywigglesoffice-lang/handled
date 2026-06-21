/**
 * Single source of truth for inbox category ownership.
 *
 * Hierarchy (strict):
 * 1. Per-email manual override (DB + local)
 * 2. Sender memory (trust-weighted personal learning)
 * 3. Category correction history for sender
 * 4. Learned sender preference
 * 4. Persisted locked category (already resolved on server with manual/sender/memory source)
 * 5. AI / heuristic categorization
 */

import { isCategoryDebugEnabled } from "@/lib/handled-debug";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { CategorySource, InboxAiCategory } from "@/lib/inbox-ai-categories";
import { isUserLockedCategorySource } from "@/lib/category-authority";
import { lookupScopedValue } from "@/lib/gmail/account-types";
import { applyUserRulesPre } from "@/lib/inbox-user-rules/apply";
import {
  lookupCorrectionHistoryCategory,
  lookupMemoryCategory,
  lookupSenderMemoryCategory,
} from "@/lib/memory-engine/apply";
import { logSenderRuleDebug, resolveSenderIdentity } from "@/lib/sender-identity";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type CategoryResolutionContext = {
  emailOverrides: Record<string, InboxAiCategory>;
  /** Learned behavioral memory — outranks sender prefs and AI after 2+ corrections. */
  memoryRules: InboxUserRule[];
  senderRules: InboxUserRule[];
};

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
  memoryRules: InboxUserRule[],
): InboxAiCategory | null {
  return lookupSenderMemoryCategory(row, memoryRules);
}

export function getCorrectionHistoryCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[],
): InboxAiCategory | null {
  return lookupCorrectionHistoryCategory(row, memoryRules);
}

/** Full memory stack — sender + correction history + patterns. */
export function getAnyMemoryCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[],
): InboxAiCategory | null {
  return lookupMemoryCategory(row, memoryRules);
}

export function getSenderLearnedCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  senderRules: InboxUserRule[],
): InboxAiCategory | null {
  const senderPre = applyUserRulesPre(row as GmailInboxRow, senderRules);
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

  return category;
}

/** True when AI categorization must not run for this email. */
export function mustSkipAiCategorization(
  row: Pick<GmailInboxRow, "id" | "sender" | "subject" | "snippet"> & {
    accountId?: string;
  },
  context: CategoryResolutionContext,
): boolean {
  if (getManualOverride(row.id, context.emailOverrides, row.accountId)) return true;
  if (getAnyMemoryCategory(row, context.memoryRules)) return true;
  if (getSenderLearnedCategory(row, context.senderRules)) return true;
  return false;
}

export function resolveFinalCategory(input: CategoryResolutionInput): CategoryResolutionResult {
  const { row, context } = input;
  const manualOverride = getManualOverride(row.id, context.emailOverrides, row.accountId);
  const memoryLearned = getMemoryLearnedCategory(row, context.memoryRules);
  const correctionHistory = getCorrectionHistoryCategory(row, context.memoryRules);
  const senderLearned = getSenderLearnedCategory(row, context.senderRules);
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
  } else if (memoryLearned) {
    finalCategory = memoryLearned;
    finalSource = "memory_rule";
  } else if (correctionHistory) {
    finalCategory = correctionHistory;
    finalSource = "memory_rule";
  } else if (senderLearned) {
    finalCategory = senderLearned;
    finalSource = "sender_rule";
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

  const winningRule: CategoryResolutionAudit["winningRule"] = manualOverride
    ? "manual_override"
    : memoryLearned
      ? "memory_rule"
      : correctionHistory
        ? "correction_history"
        : senderLearned
        ? "sender_rule"
        : persistedCategory && input.pipelineSource
          ? "persisted_locked"
          : aiCategory
            ? "ai"
            : input.pipelineCategory
              ? "pipeline"
              : "default";

  const audit: CategoryResolutionAudit = {
    emailId: row.id,
    accountId: row.accountId,
    dbCategory: input.pipelineCategory ?? aiCategory,
    manualOverride,
    memoryLearned,
    correctionHistory,
    senderLearned,
    persistedCategory,
    aiCategory,
    finalCategory,
    finalSource,
    winningRule,
  };

  return {
    category: finalCategory,
    source: finalSource,
    audit,
    skipAi: mustSkipAiCategorization(row, context),
  };
}

export function logCategoryResolution(audit: CategoryResolutionAudit): void {
  if (!isCategoryDebugEnabled()) return;

  const scope = audit.accountId ? `${audit.accountId}:${audit.emailId}` : audit.emailId;
  const line = (label: string, value: string | null) =>
    `  ${label}: ${value ?? "—"}`;

  console.log(
    [
      `[category-resolution] ${scope}`,
      line("WINNING RULE", audit.winningRule),
      line("DB / pipeline category", audit.dbCategory),
      line("manual override", audit.manualOverride),
      line("memory learned", audit.memoryLearned),
      line("correction history", audit.correctionHistory),
      line("sender learned", audit.senderLearned),
      line("persisted locked", audit.persistedCategory),
      line("AI category", audit.aiCategory),
      line("FINAL", `${audit.finalCategory} (${audit.finalSource})`),
    ].join("\n"),
  );
}

export type InboxMessageWithCategory = {
  id: string;
  accountId?: string;
  category: InboxAiCategory;
  categorySource?: CategorySource;
  sender: string;
  subject: string;
  snippet: string;
  categoryResolution?: CategoryResolutionAudit;
};

/** Client/server display gate — never trust AI category when user data exists. */
export function resolveInboxMessageForDisplay<T extends InboxMessageWithCategory>(
  message: T,
  context: CategoryResolutionContext,
): T {
  const resolved = resolveFinalCategory({
    row: message,
    pipelineCategory: message.category,
    pipelineSource: message.categorySource,
    aiCategory:
      message.categorySource === "ai" ||
      message.categorySource === "heuristic" ||
      message.categorySource === "ai_coerced"
        ? message.category
        : null,
    context,
  });

  logCategoryResolution(resolved.audit);

  return {
    ...message,
    category: resolved.category,
    categorySource: resolved.source,
    categoryResolution: resolved.audit,
  };
}

export function resolveAllInboxMessagesForDisplay<T extends InboxMessageWithCategory>(
  messages: T[],
  context: CategoryResolutionContext,
): T[] {
  return messages.map((m) => resolveInboxMessageForDisplay(m, context));
}
