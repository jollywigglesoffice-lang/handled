import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/**
 * Execution phases:
 * - pre:  runs before system rules + AI (force category, block)
 * - post: runs after AI/fallback (demote / boost overrides)
 *
 * Full pipeline: pre user rules → system rules → AI → fallback → post user rules
 */
export type InboxRulePhase = "pre" | "post";

export type InboxRuleMatchType =
  | "sender_email"
  | "sender_domain"
  | "sender_contains"
  | "subject_contains";

export type InboxRuleActionType = "force_category" | "block" | "demote" | "boost";

export type InboxUserRule = {
  id: string;
  enabled: boolean;
  /** Higher priority wins within the same phase (evaluated first). */
  priority: number;
  phase: InboxRulePhase;
  action: InboxRuleAction;
  match: InboxRuleMatch;
  /** UI label, e.g. "Doctor emails" */
  label?: string;
};

export type InboxRuleMatch =
  | { type: "sender_email"; value: string }
  | { type: "sender_domain"; value: string }
  | { type: "sender_contains"; value: string }
  | { type: "subject_contains"; value: string };

export type InboxRuleAction =
  | { type: "force_category"; category: InboxAiCategory }
  | { type: "block" }
  | {
      type: "demote";
      toCategory: InboxAiCategory;
      /** Only apply when current category is in this list (empty = any). */
      whenCategories?: InboxAiCategory[];
    }
  | {
      type: "boost";
      toCategory: InboxAiCategory;
      whenCategories?: InboxAiCategory[];
    };

export type UserRulePreResult =
  | { kind: "force"; category: InboxAiCategory; ruleId: string; label?: string }
  | { kind: "block"; category: "handled"; ruleId: string; label?: string }
  | null;

export type UserRulePostResult = {
  category: InboxAiCategory;
  ruleId: string;
  label?: string;
} | null;

export type InboxRuleRowDb = {
  id: string;
  user_id: string;
  enabled: boolean;
  priority: number;
  phase: InboxRulePhase;
  action_type: InboxRuleActionType;
  category: string | null;
  match_type: InboxRuleMatchType;
  match_value: string;
  label: string | null;
};
