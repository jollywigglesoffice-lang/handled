import { parsePersonalCompletionActionsJson } from "@/lib/completion-actions/storage";
import type { PersonalCompletionAction } from "@/lib/completion-actions/types";

export const SETUP_SQL = "supabase/sql/email_completions.sql";

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export async function loadCompletionActionsForUser(
  userId: string,
): Promise<PersonalCompletionAction[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("custom_completion_actions_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[completion-actions] load failed:", error.message);
    return [];
  }

  return parsePersonalCompletionActionsJson(data?.custom_completion_actions_json);
}

export async function saveCompletionActionsForUser(
  userId: string,
  actions: PersonalCompletionAction[],
): Promise<{ ok: true } | { ok: false; error: string; clientLocalOk?: boolean }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error, clientLocalOk: true };
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    custom_completion_actions_json: actions,
  });

  if (error) {
    const missing =
      error.message.toLowerCase().includes("custom_completion_actions_json") ||
      error.message.toLowerCase().includes("schema cache");
    return { ok: false, error: error.message, clientLocalOk: missing };
  }

  return { ok: true };
}
