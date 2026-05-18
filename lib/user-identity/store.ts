import { parseUserIdentityJson } from "@/lib/user-identity/client-storage";
import type { UserIdentity } from "@/lib/user-identity/types";
import { EMPTY_IDENTITY } from "@/lib/user-identity/types";

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export async function loadUserIdentityForUser(userId: string): Promise<UserIdentity> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("identity_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[user-identity] load failed:", error.message);
    return { ...EMPTY_IDENTITY };
  }

  return parseUserIdentityJson(data?.identity_json);
}

export async function saveUserIdentityForUser(
  userId: string,
  identity: UserIdentity,
): Promise<{ ok: true } | { ok: false; error: string; clientLocalOk?: boolean }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error, clientLocalOk: true };
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    identity_json: { ...identity, updatedAt: Date.now() },
  });

  if (error) {
    const missing =
      error.message.toLowerCase().includes("identity_json") ||
      error.message.toLowerCase().includes("schema cache");
    return { ok: false, error: error.message, clientLocalOk: missing };
  }

  return { ok: true };
}
