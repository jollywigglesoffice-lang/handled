import { supabase } from "@/lib/supabase";

/**
 * Ensures a row exists in public.users for the given Supabase Auth user.
 * Prefers email from the client when provided; otherwise loads it via Auth Admin API.
 */
export async function syncPublicUserFromAuth(
  userId: string,
  emailFromClient?: string | null,
): Promise<{ error: string | null }> {
  const trimmed = emailFromClient?.trim();
  let email: string | null = trimmed || null;

  if (!email) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      console.error("syncPublicUserFromAuth: getUserById failed", error);
    } else {
      email = data.user?.email ?? null;
    }
  }

  const row: { id: string; email?: string } = { id: userId };
  if (email) {
    row.email = email;
  }

  const { error: upsertError } = await supabase
    .from("users")
    .upsert(row, { onConflict: "id" });

  if (upsertError) {
    console.error("syncPublicUserFromAuth: upsert failed", upsertError);
    return { error: upsertError.message };
  }

  return { error: null };
}
