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
          : matchType === "keywords_contains"
            ? { type: "keywords_contains" as const, value: row.match_value }
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

function userRuleToDbInsert(userId: string, rule: InboxUserRule) {
  const category =
    rule.action.type === "force_category"
      ? rule.action.category
      : rule.action.type === "demote" || rule.action.type === "boost"
        ? rule.action.toCategory
        : null;

  return {
    id: rule.id,
    user_id: userId,
    enabled: rule.enabled,
    priority: rule.priority,
    phase: rule.phase,
    action_type: rule.action.type,
    category,
    match_type: rule.match.type,
    match_value: rule.match.value,
    label: rule.label ?? null,
  };
}

/** Active rules for categorization (DB only — no preset fallback). */
export async function loadInboxUserRulesForUser(userId: string): Promise<InboxUserRule[]> {
  const all = await loadAllInboxUserRulesForUser(userId);
  return all.filter((r) => r.enabled);
}

/** All rules for settings UI (enabled + disabled). */
export async function loadAllInboxUserRulesForUser(userId: string): Promise<InboxUserRule[]> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data, error } = await supabase
      .from("inbox_rules")
      .select("*")
      .eq("user_id", userId)
      .order("priority", { ascending: false });

    if (error) {
      console.warn("[inbox-user-rules] DB load failed:", error.message);
      return [];
    }

    return (data ?? [])
      .map((row) => dbRowToUserRule(row as InboxRuleRowDb))
      .filter((r): r is InboxUserRule => r !== null);
  } catch (e) {
    console.warn("[inbox-user-rules] load exception", e);
    return [];
  }
}

/** Replace user's rules in Supabase (full save from settings). */
export async function saveInboxUserRulesForUser(
  userId: string,
  rules: InboxUserRule[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: existing, error: listError } = await supabase
      .from("inbox_rules")
      .select("id")
      .eq("user_id", userId);

    if (listError) {
      return { ok: false, error: listError.message };
    }

    const keepIds = new Set(rules.map((r) => r.id));
    const toDelete = (existing ?? [])
      .map((r) => r.id as string)
      .filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from("inbox_rules")
        .delete()
        .in("id", toDelete);
      if (delError) {
        return { ok: false, error: delError.message };
      }
    }

    if (rules.length > 0) {
      const rows = rules.map((r) => userRuleToDbInsert(userId, r));
      const { error: upsertError } = await supabase.from("inbox_rules").upsert(rows, {
        onConflict: "id",
      });
      if (upsertError) {
        return { ok: false, error: upsertError.message };
      }
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "save failed";
    return { ok: false, error: message };
  }
}

/** Insert starter presets when the user has no saved rules yet. */
export async function seedInboxUserRulesForUser(
  userId: string,
): Promise<{ ok: true; rules: InboxUserRule[] } | { ok: false; error: string }> {
  const existing = await loadAllInboxUserRulesForUser(userId);
  if (existing.length > 0) {
    return { ok: true, rules: existing };
  }
  const { randomUUID } = await import("node:crypto");
  const presets = defaultInboxUserRules().map((r) => ({
    ...r,
    id: randomUUID(),
  }));
  const saved = await saveInboxUserRulesForUser(userId, presets);
  if (!saved.ok) {
    return { ok: false, error: saved.error };
  }
  return { ok: true, rules: presets };
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
