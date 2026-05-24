import { supabaseBrowser } from "@/lib/supabase-browser";
import { getGoogleProviderToken, saveGoogleProviderToken } from "@/lib/google-provider-token";

/**
 * Validate session and sync provider token before protected API calls.
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

  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();

  if (session?.provider_token) {
    saveGoogleProviderToken(session.provider_token);
  }

  return true;
}

/** @deprecated use ensureApiSessionCookies */
export async function ensureApiSessionWithGoogleToken(): Promise<{
  ok: boolean;
  hasGoogleToken: boolean;
}> {
  const ok = await ensureApiSessionCookies();
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const hasGoogleToken = Boolean(session?.provider_token ?? getGoogleProviderToken());
  return { ok, hasGoogleToken };
}
