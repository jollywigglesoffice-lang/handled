import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  applyUserRulesPost,
  applyUserRulesPre,
  type InboxUserRule,
} from "@/lib/inbox-user-rules";
import { ruleMatchesRow } from "@/lib/inbox-user-rules/match";
import {
  coerceNeedsAttentionCategory,
  ruleClassify,
} from "@/lib/inbox-rule-classify";
import { intelligentFallbackCategory } from "@/lib/categorize-inbox-messages";

const CATEGORY_LABELS: Record<InboxAiCategory, string> = {
  needs_attention: "Needs your attention",
  quick_reply: "Quick reply",
  newsletter: "Newsletters",
  promotion: "Promotions",
  handled: "Handled",
};

export type TriagePreviewResult = {
  finalCategory: InboxAiCategory;
  finalLabel: string;
  userRuleMatches: Array<{ label: string; destination: InboxAiCategory }>;
  builtInLabel: string | null;
  builtInCategory: InboxAiCategory | null;
  pipelineNote: string;
};

function ruleDestination(rule: InboxUserRule): InboxAiCategory {
  if (rule.action.type === "force_category") return rule.action.category;
  if (rule.action.type === "demote" || rule.action.type === "boost") {
    return rule.action.toCategory;
  }
  return "handled";
}

/** Preview how a sample email would be triaged (user rules → system rules → fallback). */
export function previewInboxTriage(
  row: GmailInboxRow,
  userRules: InboxUserRule[],
): TriagePreviewResult {
  const userRuleMatches: TriagePreviewResult["userRuleMatches"] = [];

  for (const rule of userRules) {
    if (!rule.enabled) continue;
    if (ruleMatchesRow(row, rule.match)) {
      userRuleMatches.push({
        label: rule.label ?? "Your rule",
        destination: ruleDestination(rule),
      });
    }
  }

  const userPre = applyUserRulesPre(row, userRules);
  if (userPre?.kind === "force") {
    const cat = coerceNeedsAttentionCategory(row, userPre.category);
    return {
      finalCategory: cat,
      finalLabel: CATEGORY_LABELS[cat],
      userRuleMatches,
      builtInLabel: null,
      builtInCategory: null,
      pipelineNote: "Your rule ran first and set the category (before automatic sorting).",
    };
  }
  if (userPre?.kind === "block") {
    return {
      finalCategory: "handled",
      finalLabel: CATEGORY_LABELS.handled,
      userRuleMatches,
      builtInLabel: null,
      builtInCategory: null,
      pipelineNote: "Your rule blocked this message as handled.",
    };
  }

  const system = ruleClassify(row);
  let category: InboxAiCategory;
  let builtInLabel: string | null = null;
  let builtInCategory: InboxAiCategory | null = null;
  let pipelineNote: string;

  if (system) {
    category = system.category;
    builtInCategory = system.category;
    builtInLabel =
      system.matchType === "hard"
        ? `Built-in: ${CATEGORY_LABELS[system.category]} (strong match)`
        : `Built-in: ${CATEGORY_LABELS[system.category]}`;
    pipelineNote = "Automatic sorting matched this as commercial, social, or billing.";
  } else {
    const fb = intelligentFallbackCategory(row);
    category = fb.category;
    builtInCategory = fb.category;
    builtInLabel = `Built-in fallback: ${CATEGORY_LABELS[fb.category]}`;
    pipelineNote = "No strong automatic match — used safe fallback rules.";
  }

  const post = applyUserRulesPost(row, category, userRules);
  if (post) {
    category = post.category;
    pipelineNote = "Your rule adjusted the category after automatic sorting.";
  }

  category = coerceNeedsAttentionCategory(row, category);

  return {
    finalCategory: category,
    finalLabel: CATEGORY_LABELS[category],
    userRuleMatches,
    builtInLabel,
    builtInCategory,
    pipelineNote,
  };
}

export { CATEGORY_LABELS };
