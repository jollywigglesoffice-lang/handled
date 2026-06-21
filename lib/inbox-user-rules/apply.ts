import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { findFirstMatchingRule, ruleMatchesRow, sortRulesForPhase } from "@/lib/inbox-user-rules/match";
import type {
  InboxUserRule,
  UserRulePostResult,
  UserRulePreResult,
} from "@/lib/inbox-user-rules/types";

/**
 * PRE-PHASE (highest priority in the whole pipeline)
 * 1. block → handled (can filter from inbox in API)
 * 2. force_category → exact category (skips system rules + AI)
 */
export function applyUserRulesPre(
  row: GmailInboxRow,
  rules: InboxUserRule[],
): UserRulePreResult {
  const rule = findFirstMatchingRule(row, rules, "pre");
  if (!rule) return null;

  console.log("RULE MATCH (user pre):", rule.label ?? rule.id, {
    subject: row.subject?.slice(0, 80),
    action: rule.action.type,
  });

  if (rule.action.type === "block") {
    return { kind: "block", category: "good_to_know", ruleId: rule.id, label: rule.label };
  }
  if (rule.action.type === "force_category") {
    return {
      kind: "force",
      category: rule.action.category,
      ruleId: rule.id,
      label: rule.label,
    };
  }
  return null;
}

/**
 * POST-PHASE (after system rules + AI + fallback)
 * demote / boost — adjust category when match + optional whenCategories gate passes.
 */
export function applyUserRulesPost(
  row: GmailInboxRow,
  currentCategory: InboxAiCategory,
  rules: InboxUserRule[],
): UserRulePostResult {
  for (const rule of sortRulesForPhase(rules, "post")) {
    if (!ruleMatchesRow(row, rule.match)) continue;

    if (rule.action.type === "demote" || rule.action.type === "boost") {
      const when = rule.action.whenCategories;
      if (when?.length && !when.includes(currentCategory)) continue;

      console.log("RULE MATCH (user post):", rule.label ?? rule.id, {
        subject: row.subject?.slice(0, 80),
        from: currentCategory,
        to: rule.action.toCategory,
      });

      return {
        category: rule.action.toCategory,
        ruleId: rule.id,
        label: rule.label,
      };
    }
  }

  return null;
}
