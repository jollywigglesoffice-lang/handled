import { parseCompletionLearningJson } from "@/lib/completion-learning/record";
import type { CompletionLearningStats } from "@/lib/completion-learning/types";
import { parseEmailCompletionsJson } from "@/lib/email-completions/client-storage";
import type { EmailCompletionMap } from "@/lib/email-completions/types";

export { SETUP_SQL } from "@/lib/completion-actions/store";

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export async function loadEmailCompletionsForUser(userId: string): Promise<{
  completions: EmailCompletionMap;
  learning: CompletionLearningStats;
}> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("email_completions_json, completion_learning_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[email-completions] load failed:", error.message);
    return { completions: {}, learning: { version: 1, patterns: [] } };
  }

  return {
    completions: parseEmailCompletionsJson(data?.email_completions_json),
    learning: parseCompletionLearningJson(data?.completion_learning_json),
  };
}

export async function saveEmailCompletionsForUser(
  userId: string,
  completions: EmailCompletionMap,
  learning: CompletionLearningStats,
): Promise<{ ok: true } | { ok: false; error: string; clientLocalOk?: boolean }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error, clientLocalOk: true };
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    email_completions_json: completions,
    completion_learning_json: learning,
  });

  if (error) {
    const missing =
      error.message.toLowerCase().includes("email_completions_json") ||
      error.message.toLowerCase().includes("completion_learning_json") ||
      error.message.toLowerCase().includes("schema cache");
    return { ok: false, error: error.message, clientLocalOk: missing };
  }

  return { ok: true };
}
