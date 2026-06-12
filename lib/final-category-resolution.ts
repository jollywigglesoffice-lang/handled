/**
 * Single source of truth for inbox category ownership.
 *
 * Hierarchy (strict):
 * 1. Per-email manual override (DB + local)
 * 2. Learned sender preference
 * 3. Persisted locked category (already resolved on server with manual/sender source)
 * 4. AI / heuristic categorization
 */

import type { GmailInboxRow } from "@/lib/gmail-api";
import type { CategorySource, InboxAiCategory } from "@/lib/inbox-ai-categories";
import { isUserLockedCategorySource } from "@/lib/category-authority";
import { lookupScopedValue } from "@/lib/gmail/account-types";
import { applyUserRulesPre } from "@/lib/inbox-user-rules/apply";
import { logSenderRuleDebug, resolveSenderIdentity } from "@/lib/sender-identity";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type CategoryResolutionContext = {
  emailOverrides: Record<string, InboxAiCategory>;
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
  dbCategory: InboxAiCategory | null;
  manualOverride: InboxAiCategory | null;
  senderLearned: InboxAiCategory | null;
  persistedCategory: InboxAiCategory | null;
  aiCategory: InboxAiCategory | null;
  finalCategory: InboxAiCategory;
  finalSource: CategorySource;
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

export function getSenderLearnedCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  senderRules: InboxUserRule[],
): InboxAiCategory | null {
  const senderPre = applyUserRulesPre(row as GmailInboxRow, senderRules);
  const category =
    senderPre?.kind === "force"
      ? senderPre.category
      : senderPre?.kind === "block"
        ? "handled"
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
  if (getSenderLearnedCategory(row, context.senderRules)) return true;
  return false;
}

export function resolveFinalCategory(input: CategoryResolutionInput): CategoryResolutionResult {
  const { row, context } = input;
  const manualOverride = getManualOverride(row.id, context.emailOverrides, row.accountId);
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
    finalCategory = "needs_attention";
    finalSource = "heuristic";
  }

  const audit: CategoryResolutionAudit = {
    emailId: row.id,
    dbCategory: input.pipelineCategory ?? aiCategory,
    manualOverride,
    senderLearned,
    persistedCategory,
    aiCategory,
    finalCategory,
    finalSource,
  };

  return {
    category: finalCategory,
    source: finalSource,
    audit,
    skipAi: mustSkipAiCategorization(row, context),
  };
}

export function logCategoryResolution(audit: CategoryResolutionAudit): void {
  const enabled =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_CATEGORY_RESOLUTION_DEBUG === "1";
  if (!enabled) return;

  const line = (label: string, value: string | null) =>
    `  ${label}: ${value ?? "—"}`;

  console.log(
    [
      `[category-resolution] EMAIL ${audit.emailId}`,
      line("DB / pipeline category", audit.dbCategory),
      line("manual override", audit.manualOverride),
      line("sender learned", audit.senderLearned),
      line("persisted locked", audit.persistedCategory),
      line("AI category", audit.aiCategory),
      line("FINAL category", `${audit.finalCategory} (${audit.finalSource})`),
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
