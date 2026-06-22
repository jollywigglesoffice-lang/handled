import { supabaseBrowser } from "@/lib/supabase-browser";
import { getGoogleProviderToken, saveGoogleProviderToken } from "@/lib/google-provider-token";

const SESSION_HYDRATION_DELAYS_MS = [0, 120, 240, 400];

/**
 * Validate session and sync provider token before protected API calls.
 * Retries briefly after OAuth so client cookies can finish hydrating.
 */
export async function ensureApiSessionCookies(): Promise<boolean> {
  for (let attempt = 0; attempt < SESSION_HYDRATION_DELAYS_MS.length; attempt++) {
    const delay = SESSION_HYDRATION_DELAYS_MS[attempt];
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const {
      data: { user },
      error,
    } = await supabaseBrowser.auth.getUser();

    if (error) {
      console.error("[auth] ensureApiSessionCookies getUser", error.message);
      continue;
    }

    if (!user?.id) {
      continue;
    }

    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    if (session?.provider_token) {
      saveGoogleProviderToken(session.provider_token);
    }

    return true;
  }

  return false;
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
