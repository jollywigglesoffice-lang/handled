import { AUTH_DEBUG_ENABLED } from "@/lib/auth/debug-log";
import { getGoogleProviderToken } from "@/lib/google-provider-token";
import { HANDLED_PROVIDER_TOKEN_HEADER } from "@/lib/auth/resolve-api-auth";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Headers so protected /api/* routes can authenticate via cookies and/or Bearer JWT.
 */
export async function protectedApiHeaders(
  extra?: HeadersInit,
): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();

  const {
    data: { user },
    error: userError,
  } = await supabaseBrowser.auth.getUser();

  if (userError) {
    console.error("[auth] protectedApiHeaders getUser", userError.message);
  }

  const headers: Record<string, string> = {};

  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(extra)) {
      for (const [key, value] of extra) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, extra);
    }
  }

  const accessToken = session?.access_token;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const googleToken = session?.provider_token ?? getGoogleProviderToken();
  if (googleToken) {
    headers[HANDLED_PROVIDER_TOKEN_HEADER] = googleToken;
  }

  if (AUTH_DEBUG_ENABLED && typeof window !== "undefined") {
    console.log("[auth-debug] client protectedApiHeaders", {
      hasUser: Boolean(user?.id),
      hasAccessToken: Boolean(accessToken),
      hasGoogleToken: Boolean(googleToken),
      documentCookieHasSb: document.cookie.includes("auth-token"),
    });
  }

  return headers;
}
