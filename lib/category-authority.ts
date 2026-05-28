import type { GmailInboxRow } from "@/lib/gmail-api";
import type { CategorySource, InboxAiCategory } from "@/lib/inbox-ai-categories";
import { applyUserRulesPre } from "@/lib/inbox-user-rules/apply";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

/** Sources that must never be altered by AI, heuristics, workflow, or relationship coercion. */
export function isUserLockedCategorySource(source: CategorySource): boolean {
  return source === "manual_override" || source === "sender_rule";
}

export type CategoryAuthorityInput = {
  row: GmailInboxRow;
  emailOverrides: Record<string, InboxAiCategory>;
  senderRules: InboxUserRule[];
};

export type CategoryAuthorityResult = {
  category: InboxAiCategory;
  source: CategorySource;
  locked: boolean;
};

/**
 * Resolve category before AI/heuristics — strict hierarchy:
 * 1. Per-email manual override
 * 2. Learned sender rule
 */
export function resolvePreAiCategoryAuthority(
  input: CategoryAuthorityInput,
): CategoryAuthorityResult | null {
  const manual = input.emailOverrides[input.row.id];
  if (manual) {
    return { category: manual, source: "manual_override", locked: true };
  }

  const senderPre = applyUserRulesPre(input.row, input.senderRules);
  if (senderPre?.kind === "force") {
    return { category: senderPre.category, source: "sender_rule", locked: true };
  }
  if (senderPre?.kind === "block") {
    return { category: "handled", source: "sender_rule", locked: true };
  }

  return null;
}

/** Belt-and-suspenders: re-apply per-email overrides after full pipeline. */
export function enforceEmailOverrideMap<T extends GmailInboxRow & {
  category: InboxAiCategory;
  categorySource?: CategorySource;
  categoryConfidence?: number;
  relationship?: SenderRelationshipProfile | null;
}>(
  rows: T[],
  emailOverrides: Record<string, InboxAiCategory>,
): T[] {
  if (!Object.keys(emailOverrides).length) return rows;

  return rows.map((row) => {
    const forced = emailOverrides[row.id];
    if (!forced) return row;
    return {
      ...row,
      category: forced,
      categorySource: "manual_override" as const,
      categoryConfidence: 1,
    };
  });
}
