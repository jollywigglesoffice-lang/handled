import {
  isUsersJsonColumnMissingError,
  parseSenderPreferencesJson,
} from "@/lib/inbox-sender-preferences-storage";
import type { SenderPreference } from "@/lib/inbox-sender-preferences";

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

async function loadFromUsersJson(userId: string): Promise<SenderPreference[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("sender_preferences_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[sender-preferences] load failed:", error.message);
    return [];
  }

  return parseSenderPreferencesJson(data?.sender_preferences_json);
}

async function saveToUsersJson(
  userId: string,
  prefs: SenderPreference[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error };
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    sender_preferences_json: prefs,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function loadSenderPreferencesForUser(userId: string): Promise<SenderPreference[]> {
  return loadFromUsersJson(userId);
}

export async function saveSenderPreferencesForUser(
  userId: string,
  prefs: SenderPreference[],
): Promise<
  | { ok: true; storageMode: "users_json_column" | "client_local" }
  | { ok: false; error: string; hint?: string }
> {
  const result = await saveToUsersJson(userId, prefs);
  if (result.ok) {
    return { ok: true, storageMode: "users_json_column" };
  }

  if (isUsersJsonColumnMissingError(result.error)) {
    return {
      ok: false,
      error: result.error,
      hint: "Run supabase/sql/inbox_personalization_setup.sql in Supabase SQL Editor.",
    };
  }

  return { ok: false, error: result.error };
}
