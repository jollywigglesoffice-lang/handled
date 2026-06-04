import { parsePersonalCategoriesJson } from "@/lib/personal-categories/storage";
import type { PersonalInboxCategory } from "@/lib/personal-categories/types";

export const SETUP_SQL = "supabase/sql/custom_inbox_categories.sql";

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export async function loadPersonalCategoriesForUser(
  userId: string,
): Promise<PersonalInboxCategory[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("custom_categories_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[personal-categories] load failed:", error.message);
    return [];
  }

  return parsePersonalCategoriesJson(data?.custom_categories_json);
}

export async function savePersonalCategoriesForUser(
  userId: string,
  categories: PersonalInboxCategory[],
): Promise<{ ok: true } | { ok: false; error: string; clientLocalOk?: boolean }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) {
    return { ok: false, error: sync.error, clientLocalOk: true };
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    custom_categories_json: categories,
  });

  if (error) {
    const missing =
      error.message.toLowerCase().includes("custom_categories_json") ||
      error.message.toLowerCase().includes("schema cache");
    return { ok: false, error: error.message, clientLocalOk: missing };
  }

  return { ok: true };
}
