import type { GmailInboxRow } from "@/lib/gmail-api";
import type { CategorySource, InboxAiCategory } from "@/lib/inbox-ai-categories";
import { lookupScopedValue } from "@/lib/gmail/account-types";
import { applyUserRulesPre } from "@/lib/inbox-user-rules/apply";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

/** Sources that must never be altered by AI, heuristics, workflow, or relationship coercion. */
export function isUserLockedCategorySource(source: CategorySource): boolean {
  return (
    source === "manual_override" || source === "sender_rule" || source === "memory_rule"
  );
}

export type CategoryAuthorityInput = {
  row: GmailInboxRow;
  emailOverrides: Record<string, InboxAiCategory>;
  memoryRules: InboxUserRule[];
  senderRules: InboxUserRule[];
};

export type CategoryAuthorityResult = {
  category: InboxAiCategory;
  source: CategorySource;
  locked: boolean;
  ruleLabel?: string;
};

/**
 * Resolve category before AI/heuristics — strict hierarchy:
 * 1. Per-email manual override
 * 2. Learned sender rule (onboarding + explicit sender feedback)
 * 3. Behavioral memory rule
 */
export function resolvePreAiCategoryAuthority(
  input: CategoryAuthorityInput,
): CategoryAuthorityResult | null {
  const manual = lookupScopedValue(
    input.emailOverrides,
    input.row.id,
    input.row.accountId,
  );
  if (manual) {
    return { category: manual, source: "manual_override", locked: true };
  }

  const senderPre = applyUserRulesPre(input.row, input.senderRules);
  if (senderPre?.kind === "force") {
    return {
      category: senderPre.category,
      source: "sender_rule",
      locked: true,
      ruleLabel: senderPre.label,
    };
  }
  if (senderPre?.kind === "block") {
    return {
      category: "good_to_know",
      source: "sender_rule",
      locked: true,
      ruleLabel: senderPre.label,
    };
  }

  const memoryPre = applyUserRulesPre(input.row, input.memoryRules);
  if (memoryPre?.kind === "force") {
    return {
      category: memoryPre.category,
      source: "memory_rule",
      locked: true,
      ruleLabel: memoryPre.label,
    };
  }
  if (memoryPre?.kind === "block") {
    return {
      category: "good_to_know",
      source: "memory_rule",
      locked: true,
      ruleLabel: memoryPre.label,
    };
  }

  return null;
}

/** Belt-and-suspenders: re-apply per-email overrides after full pipeline. */
export function enforceEmailOverrideMap<T extends GmailInboxRow & {
  category: InboxAiCategory;
  categorySource?: CategorySource;
  categoryConfidence?: number;
  relationship?: SenderRelationshipProfile | null;
  accountId?: string;
}>(
  rows: T[],
  emailOverrides: Record<string, InboxAiCategory>,
): T[] {
  if (!Object.keys(emailOverrides).length) return rows;

  return rows.map((row) => {
    const forced = lookupScopedValue(emailOverrides, row.id, row.accountId);
    if (!forced) return row;
    return {
      ...row,
      category: forced,
      categorySource: "manual_override" as const,
      categoryConfidence: 1,
    };
  });
}
