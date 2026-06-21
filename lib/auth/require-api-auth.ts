import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_DEBUG_ENABLED } from "@/lib/auth/debug-log";
import { resolveApiAuth, type ResolvedApiAuth } from "@/lib/auth/resolve-api-auth";
import type { ServerAuthSession } from "@/lib/auth/server-session";
import { getFreshGoogleAccessToken } from "@/lib/google/google-access-token";
import { getConnectedGmailAccount } from "@/lib/google/connected-accounts";
import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";

export type ApiAuthResult =
  | { ok: true; auth: ServerAuthSession | ResolvedApiAuth }
  | { ok: false; response: NextResponse };

export type GoogleTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; response: NextResponse; failureReason: InboxLoadFailureReason };

/** Validated session from cookies and/or Authorization Bearer. */
export async function requireApiAuth(
  request: Request,
  supabase: SupabaseClient | null,
): Promise<ApiAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json({ error: "server_unavailable", failureReason: "server_unavailable" }, { status: 500 }),
    };
  }

  const { auth, debug } = await resolveApiAuth(request, supabase);
  if (!auth) {
    const body: Record<string, unknown> = {
      error: "auth_error",
      failureReason: "auth_error",
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
  const strictAccount = Boolean(accountId);

  if (userId && accountId) {
    const account = await getConnectedGmailAccount(userId, accountId);
    if (!account) {
      console.error("[requireGoogleProviderToken] invalid accountId", {
        accountId,
        userId,
      });
      return {
        ok: false,
        failureReason: "missing_account",
        response: NextResponse.json(
          {
            error: "missing_account",
            failureReason: "missing_account",
            accountId,
            reason: "account_not_connected",
            ...extra,
          },
          { status: 400 },
        ),
      };
    }
  }

  if (userId) {
    const fresh = await getFreshGoogleAccessToken(userId, { accountId, strictAccount });
    if (fresh) {
      return { ok: true, accessToken: fresh };
    }
    if (strictAccount) {
      console.error("[requireGoogleProviderToken] token lookup failed for account", {
        accountId,
        userId,
      });
      return {
        ok: false,
        failureReason: "auth_error",
        response: NextResponse.json(
          {
            error: "auth_error",
            failureReason: "auth_error",
            authRequired: true,
            reason: "account_token_unavailable",
            accountId,
            ...extra,
          },
          { status: 403 },
        ),
      };
    }
  }

  // Compatibility fallback: token from the session cookie or the
  // X-Handled-Provider-Token header. Not the source of truth — used only until
  // the user reconnects and we have a stored refresh token.
  if (!strictAccount && auth.providerToken) {
    return { ok: true, accessToken: auth.providerToken };
  }

  const body: Record<string, unknown> = {
    error: "missing_account",
    failureReason: "missing_account",
    authRequired: true,
    reason: "connect_gmail",
    ...extra,
  };
  if (AUTH_DEBUG_ENABLED) {
    body._authDebug = { failureReason: "missing_google_provider_token" };
  }
  return {
    ok: false,
    failureReason: "missing_account",
    response: NextResponse.json(body, { status: 403 }),
  };
}
