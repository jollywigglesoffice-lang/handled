import type { HandledBrain } from "@/lib/handled-brain/types";
import { EMPTY_BRAIN } from "@/lib/handled-brain/types";

function parseBrainJson(value: unknown): HandledBrain {
  if (!value || typeof value !== "object") return EMPTY_BRAIN;
  const o = value as HandledBrain;
  return {
    entries: Array.isArray(o.entries) ? o.entries : [],
    writingStyle: typeof o.writingStyle === "string" ? o.writingStyle : undefined,
  };
}

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export async function loadHandledBrainForUser(userId: string): Promise<HandledBrain> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("handled_brain_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[handled-brain] load failed:", error.message);
    return EMPTY_BRAIN;
  }

  return parseBrainJson(data?.handled_brain_json);
}

export async function saveHandledBrainForUser(
  userId: string,
  brain: HandledBrain,
): Promise<{ ok: true } | { ok: false; error: string; clientLocalOk?: boolean }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error, clientLocalOk: true };
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    handled_brain_json: brain,
  });

  if (error) {
    const missing =
      error.message.toLowerCase().includes("handled_brain_json") ||
      error.message.toLowerCase().includes("schema cache");
    return {
      ok: false,
      error: error.message,
      clientLocalOk: missing,
    };
  }

  return { ok: true };
}
