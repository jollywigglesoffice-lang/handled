import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Before same-origin /api/* calls, validate the session and persist it into
 * document cookies so Route Handlers see the same auth as the browser client.
 */
export async function ensureApiSessionCookies(): Promise<boolean> {
  const {
    data: { user },
    error,
  } = await supabaseBrowser.auth.getUser();

  if (error) {
    console.error("[auth] ensureApiSessionCookies getUser", error.message);
    return false;
  }

  if (!user?.id) {
    return false;
  }

  // Writes/refreshes sb-* cookies used by createServerClient on the server.
  await supabaseBrowser.auth.getSession();
  return true;
}
