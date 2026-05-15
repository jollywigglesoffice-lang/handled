import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { defaultInboxUserRules } from "@/lib/inbox-user-rules/presets";
import type {
  InboxRuleAction,
  InboxRuleActionType,
  InboxRuleMatchType,
  InboxRulePhase,
  InboxUserRule,
} from "@/lib/inbox-user-rules/types";

export type { InboxRuleRowDb } from "@/lib/inbox-user-rules/types";
import type { InboxRuleRowDb } from "@/lib/inbox-user-rules/types";

function rowToAction(
  actionType: InboxRuleActionType,
  category: string | null,
): InboxRuleAction | null {
  switch (actionType) {
    case "force_category":
      if (!category) return null;
      return { type: "force_category", category: category as InboxAiCategory };
    case "block":
      return { type: "block" };
    case "demote":
      if (!category) return null;
      return { type: "demote", toCategory: category as InboxAiCategory };
    case "boost":
      if (!category) return null;
      return { type: "boost", toCategory: category as InboxAiCategory };
    default:
      return null;
  }
}

export function dbRowToUserRule(row: InboxRuleRowDb): InboxUserRule | null {
  const matchType = row.match_type as InboxRuleMatchType;
  const match =
    matchType === "sender_email"
      ? { type: "sender_email" as const, value: row.match_value }
      : matchType === "sender_domain"
        ? { type: "sender_domain" as const, value: row.match_value }
        : matchType === "sender_contains"
          ? { type: "sender_contains" as const, value: row.match_value }
          : matchType === "subject_contains"
            ? { type: "subject_contains" as const, value: row.match_value }
            : null;

  if (!match) return null;

  const action = rowToAction(row.action_type, row.category);
  if (!action) return null;

  return {
    id: row.id,
    enabled: row.enabled,
    priority: row.priority,
    phase: row.phase as InboxRulePhase,
    action,
    match,
    label: row.label ?? undefined,
  };
}

/** Load rules from Supabase; falls back to built-in presets if table empty or unavailable. */
export async function loadInboxUserRulesForUser(userId: string): Promise<InboxUserRule[]> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data, error } = await supabase
      .from("inbox_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("priority", { ascending: false });

    if (error) {
      console.warn("[inbox-user-rules] DB load failed, using presets:", error.message);
      return defaultInboxUserRules();
    }

    const parsed = (data ?? [])
      .map((row) => dbRowToUserRule(row as InboxRuleRowDb))
      .filter((r): r is InboxUserRule => r !== null);

    if (parsed.length === 0) {
      return defaultInboxUserRules();
    }

    return parsed;
  } catch (e) {
    console.warn("[inbox-user-rules] load exception, using presets", e);
    return defaultInboxUserRules();
  }
}

export function mergeInboxUserRules(
  dbRules: InboxUserRule[],
  localRules: InboxUserRule[],
): InboxUserRule[] {
  const byId = new Map<string, InboxUserRule>();
  for (const r of defaultInboxUserRules()) {
    byId.set(r.id, r);
  }
  for (const r of dbRules) {
    byId.set(r.id, r);
  }
  for (const r of localRules) {
    byId.set(r.id, r);
  }
  return [...byId.values()];
}
