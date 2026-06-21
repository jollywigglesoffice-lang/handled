import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  inboxCategorySelectorLabel,
  type InboxAiCategory,
} from "@/lib/inbox-ai-categories";
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

function categoryLabel(category: InboxAiCategory): string {
  return inboxCategorySelectorLabel(category, "en");
}

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
  return "good_to_know";
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
      finalLabel: categoryLabel(cat),
      userRuleMatches,
      builtInLabel: null,
      builtInCategory: null,
      pipelineNote: "Your rule ran first and set the category (before automatic sorting).",
    };
  }
  if (userPre?.kind === "block") {
    return {
      finalCategory: "good_to_know",
      finalLabel: categoryLabel("good_to_know"),
      userRuleMatches,
      builtInLabel: null,
      builtInCategory: null,
      pipelineNote: "Your rule blocked this message as good to know.",
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
        ? `Built-in: ${categoryLabel(system.category)} (strong match)`
        : `Built-in: ${categoryLabel(system.category)}`;
    pipelineNote = "Automatic sorting matched this as commercial, social, or billing.";
  } else {
    const fb = intelligentFallbackCategory(row);
    category = fb.category;
    builtInCategory = fb.category;
    builtInLabel = `Built-in fallback: ${categoryLabel(fb.category)}`;
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
    finalLabel: categoryLabel(category),
    userRuleMatches,
    builtInLabel,
    builtInCategory,
    pipelineNote,
  };
}

