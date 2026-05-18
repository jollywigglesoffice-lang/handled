import { parseWorkflowMode, type WorkflowMode } from "@/lib/workflow-mode";

export const SETUP_SQL = "supabase/sql/workflow_mode_setup.sql";

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export async function loadWorkflowModeForUser(userId: string): Promise<WorkflowMode | null> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("workflow_mode")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.message.toLowerCase().includes("workflow_mode")) return null;
    console.warn("[workflow-mode] load failed:", error.message);
    return null;
  }

  const raw = data?.workflow_mode;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return parseWorkflowMode(raw);
}

export async function saveWorkflowModeForUser(
  userId: string,
  mode: WorkflowMode,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    workflow_mode: mode,
  });

  if (error) {
    if (error.message.toLowerCase().includes("workflow_mode")) {
      return {
        ok: false,
        error: "Run supabase/sql/workflow_mode_setup.sql in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
