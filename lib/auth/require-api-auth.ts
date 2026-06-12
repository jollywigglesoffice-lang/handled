import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_DEBUG_ENABLED } from "@/lib/auth/debug-log";
import { resolveApiAuth, type ResolvedApiAuth } from "@/lib/auth/resolve-api-auth";
import type { ServerAuthSession } from "@/lib/auth/server-session";
import { getFreshGoogleAccessToken } from "@/lib/google/google-access-token";

export type ApiAuthResult =
  | { ok: true; auth: ServerAuthSession | ResolvedApiAuth }
  | { ok: false; response: NextResponse };

export type GoogleTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; response: NextResponse };

/** Validated session from cookies and/or Authorization Bearer. */
export async function requireApiAuth(
  request: Request,
  supabase: SupabaseClient | null,
): Promise<ApiAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }),
    };
  }

  const { auth, debug } = await resolveApiAuth(request, supabase);
  if (!auth) {
    const body: Record<string, unknown> = {
      error: "Unauthorized",
      authRequired: true,
    };
    if (AUTH_DEBUG_ENABLED) {
      body._authDebug = debug;
    }
    return {
      ok: false,
      response: NextResponse.json(body, { status: 401 }),
    };
  }

  return { ok: true, auth };
}

/**
 * Resolve a usable Google access token for the request, always preferring a
 * server-refreshed token minted from the stored refresh token. Falls back to the
 * session/header provider token only for users who haven't reconnected yet
 * (no stored refresh token). Both Gmail routes call this, so they share the
 * exact same refreshed-token source.
 */
export async function requireGoogleProviderToken(
  auth: ServerAuthSession | ResolvedApiAuth,
  extra?: Record<string, unknown> & { accountId?: string | null },
): Promise<GoogleTokenResult> {
  const userId = auth.user?.id;
  const accountId = extra?.accountId ?? null;

  if (userId) {
    const fresh = await getFreshGoogleAccessToken(userId, { accountId });
    if (fresh) {
      return { ok: true, accessToken: fresh };
    }
  }

  // Compatibility fallback: token from the session cookie or the
  // X-Handled-Provider-Token header. Not the source of truth — used only until
  // the user reconnects and we have a stored refresh token.
  if (auth.providerToken) {
    return { ok: true, accessToken: auth.providerToken };
  }

  const body: Record<string, unknown> = {
    error: "missing_google_token",
    authRequired: true,
    reason: "connect_gmail",
    ...extra,
  };
  if (AUTH_DEBUG_ENABLED) {
    body._authDebug = { failureReason: "missing_google_provider_token" };
  }
  return {
    ok: false,
    response: NextResponse.json(body, { status: 403 }),
  };
}
