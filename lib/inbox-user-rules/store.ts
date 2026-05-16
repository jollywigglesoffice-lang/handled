import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type {
  InboxRuleAction,
  InboxRuleActionType,
  InboxRuleMatchType,
  InboxRulePhase,
  InboxUserRule,
} from "@/lib/inbox-user-rules/types";

export type { InboxRuleRowDb } from "@/lib/inbox-user-rules/types";
import type { InboxRuleRowDb } from "@/lib/inbox-user-rules/types";
import {
  isInboxRulesTableMissingError,
  parseRulesJson,
  type InboxRulesStorageMode,
} from "@/lib/inbox-user-rules/storage";

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

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

async function loadFromUsersJson(userId: string): Promise<InboxUserRule[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("inbox_rules_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[inbox-user-rules] users.inbox_rules_json load failed:", error.message);
    return [];
  }

  return parseRulesJson(data?.inbox_rules_json);
}

async function saveToUsersJson(
  userId: string,
  rules: InboxUserRule[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error };
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    inbox_rules_json: rules,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function loadFromInboxRulesTable(userId: string): Promise<{
  rules: InboxUserRule[];
  error: string | null;
}> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("inbox_rules")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: false });

  if (error) {
    return { rules: [], error: error.message };
  }

  const rules = (data ?? [])
    .map((row) => dbRowToUserRule(row as InboxRuleRowDb))
    .filter((r): r is InboxUserRule => r !== null);

  return { rules, error: null };
}

async function saveToInboxRulesTable(
  userId: string,
  rules: InboxUserRule[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getSupabaseAdmin();

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
    const { error: delError } = await supabase.from("inbox_rules").delete().in("id", toDelete);
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
}

export type LoadRulesResult = {
  rules: InboxUserRule[];
  storageMode: InboxRulesStorageMode;
  dbError?: string;
};

/** Load all rules for settings (table preferred, JSON column fallback). */
export async function loadAllInboxUserRulesForUser(userId: string): Promise<LoadRulesResult> {
  const table = await loadFromInboxRulesTable(userId);

  if (!table.error) {
    return { rules: table.rules, storageMode: "inbox_rules_table" };
  }

  if (isInboxRulesTableMissingError(table.error)) {
    const jsonRules = await loadFromUsersJson(userId);
    return {
      rules: jsonRules,
      storageMode: jsonRules.length ? "users_json_column" : "none",
      dbError: table.error,
    };
  }

  console.warn("[inbox-user-rules] table load error:", table.error);
  const jsonRules = await loadFromUsersJson(userId);
  return {
    rules: jsonRules,
    storageMode: jsonRules.length ? "users_json_column" : "none",
    dbError: table.error,
  };
}

/** Active rules for categorization. */
export async function loadInboxUserRulesForUser(userId: string): Promise<InboxUserRule[]> {
  const { rules } = await loadAllInboxUserRulesForUser(userId);
  return rules.filter((r) => r.enabled);
}

export type SaveRulesResult =
  | { ok: true; storageMode: InboxRulesStorageMode }
  | { ok: false; error: string; hint?: string };

/** Persist rules (table + JSON mirror for resilience). */
export async function saveInboxUserRulesForUser(
  userId: string,
  rules: InboxUserRule[],
): Promise<SaveRulesResult> {
  const tableResult = await saveToInboxRulesTable(userId, rules);

  if (tableResult.ok) {
    await saveToUsersJson(userId, rules).catch(() => undefined);
    return { ok: true, storageMode: "inbox_rules_table" };
  }

  if (isInboxRulesTableMissingError(tableResult.error)) {
    const jsonResult = await saveToUsersJson(userId, rules);
    if (jsonResult.ok) {
      return {
        ok: true,
        storageMode: "users_json_column",
      };
    }
    return {
      ok: false,
      error: jsonResult.error,
      hint: "Run supabase/sql/inbox_rules_setup.sql in the Supabase SQL Editor, then save again.",
    };
  }

  const jsonResult = await saveToUsersJson(userId, rules);
  if (jsonResult.ok) {
    return { ok: true, storageMode: "users_json_column" };
  }

  return { ok: false, error: tableResult.error, hint: tableResult.error };
}

export async function seedInboxUserRulesForUser(
  userId: string,
): Promise<{ ok: true; rules: InboxUserRule[] } | { ok: false; error: string }> {
  const { rules: existing } = await loadAllInboxUserRulesForUser(userId);
  if (existing.length > 0) {
    return { ok: true, rules: existing };
  }
  const { defaultInboxUserRules } = await import("@/lib/inbox-user-rules/presets");
  const presets = defaultInboxUserRules().map((r, i) => ({
    ...r,
    id: `preset-seed-${i}-${Date.now()}`,
  }));
  const saved = await saveInboxUserRulesForUser(userId, presets);
  if (!saved.ok) {
    return { ok: false, error: saved.error };
  }
  return { ok: true, rules: presets };
}
