import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import type { SenderPreference } from "@/lib/inbox-sender-preferences";
import { parseSenderPreferencesJson } from "@/lib/inbox-sender-preferences-storage";
import {
  isSenderRulesTableMissingError,
  rowToSenderRule,
  senderRuleToRow,
  SETUP_SQL,
} from "@/lib/sender-rules/storage";
import type { SenderRule } from "@/lib/sender-rules/types";

export { SETUP_SQL };

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

function prefToRule(pref: SenderPreference): SenderRule {
  return {
    id: pref.id,
    senderEmail: pref.senderEmail,
    senderDomain: pref.senderDomain,
    targetCategory: pref.category,
    label: pref.label,
    enabled: pref.enabled !== false,
    createdAt: pref.createdAt,
    updatedAt: pref.updatedAt ?? pref.createdAt,
  };
}

export function ruleToPreference(rule: SenderRule): SenderPreference {
  return {
    id: rule.id,
    senderEmail: rule.senderEmail,
    senderDomain: rule.senderDomain,
    category: rule.targetCategory,
    label: rule.label,
    enabled: rule.enabled,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export function rulesToPreferences(rules: SenderRule[]): SenderPreference[] {
  return rules.map(ruleToPreference);
}

async function loadFromJsonColumn(userId: string): Promise<SenderRule[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("sender_preferences_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[sender-rules] json load failed:", error.message);
    return [];
  }

  return parseSenderPreferencesJson(data?.sender_preferences_json).map(prefToRule);
}

async function saveToJsonColumn(
  userId: string,
  rules: SenderRule[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    sender_preferences_json: rulesToPreferences(rules),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function loadFromTable(userId: string): Promise<SenderRule[] | null> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sender_rules")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isSenderRulesTableMissingError(error.message)) return null;
    console.warn("[sender-rules] table load failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    rowToSenderRule({
      id: String(row.id),
      sender_email: String(row.sender_email ?? ""),
      sender_domain: String(row.sender_domain ?? ""),
      target_category: normalizeInboxAiCategory(String(row.target_category ?? "worth_your_attention")),
      label: row.label != null ? String(row.label) : null,
      enabled: Boolean(row.enabled ?? true),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }),
  );
}

async function saveToTable(
  userId: string,
  rules: SenderRule[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const rows = rules.map((r) => senderRuleToRow(userId, r));

  const { data: existing } = await supabase
    .from("sender_rules")
    .select("id")
    .eq("user_id", userId);

  const keepIds = new Set(rows.map((r) => r.id));
  const toDelete = (existing ?? [])
    .map((e) => String(e.id))
    .filter((id) => !keepIds.has(id));

  if (toDelete.length) {
    const { error: delErr } = await supabase
      .from("sender_rules")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  if (rows.length) {
    const { error: upsertErr } = await supabase.from("sender_rules").upsert(rows);
    if (upsertErr) return { ok: false, error: upsertErr.message };
  }

  return { ok: true };
}

export async function loadSenderRulesForUser(userId: string): Promise<SenderRule[]> {
  const fromTable = await loadFromTable(userId);
  if (fromTable !== null) {
    if (fromTable.length > 0) return fromTable;
    const legacy = await loadFromJsonColumn(userId);
    if (legacy.length) {
      void saveSenderRulesForUser(userId, legacy);
    }
    return legacy;
  }
  return loadFromJsonColumn(userId);
}

export async function saveSenderRulesForUser(
  userId: string,
  rules: SenderRule[],
): Promise<
  | { ok: true; storageMode: "sender_rules_table" | "users_json_column" }
  | { ok: false; error: string; hint?: string }
> {
  const tableResult = await saveToTable(userId, rules);
  if (tableResult.ok) {
    await saveToJsonColumn(userId, rules).catch(() => {});
    return { ok: true, storageMode: "sender_rules_table" };
  }

  if (isSenderRulesTableMissingError(tableResult.error)) {
    const jsonResult = await saveToJsonColumn(userId, rules);
    if (jsonResult.ok) {
      return { ok: true, storageMode: "users_json_column" };
    }
    return {
      ok: false,
      error: jsonResult.error,
      hint: "Run supabase/sql/sender_rules.sql in Supabase SQL Editor.",
    };
  }

  return { ok: false, error: tableResult.error };
}

/** @deprecated use loadSenderRulesForUser */
export async function loadSenderPreferencesForUser(userId: string): Promise<SenderPreference[]> {
  return rulesToPreferences(await loadSenderRulesForUser(userId));
}

/** @deprecated use saveSenderRulesForUser */
export async function saveSenderPreferencesForUser(
  userId: string,
  prefs: SenderPreference[],
): Promise<
  | { ok: true; storageMode: "sender_rules_table" | "users_json_column" }
  | { ok: false; error: string; hint?: string }
> {
  return saveSenderRulesForUser(
    userId,
    prefs.map(prefToRule),
  );
}
