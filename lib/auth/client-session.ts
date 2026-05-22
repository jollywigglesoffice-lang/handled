import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Re-check Supabase session before calling protected APIs.
 * Uses getUser() (validated) — getSession() alone can be stale and cause 401s on the server.
 */
export async function hasAuthenticatedSession(): Promise<boolean> {
  const { data, error } = await supabaseBrowser.auth.getUser();
  if (error) {
    console.error("[auth] hasAuthenticatedSession getUser error", error.message);
    return false;
  }
  return Boolean(data.user?.id);
}
