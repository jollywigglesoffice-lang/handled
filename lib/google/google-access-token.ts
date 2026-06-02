import type { Session } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "@/lib/google/refresh-google-token";
import {
  cacheGoogleAccessToken,
  clearGoogleTokens,
  getStoredGoogleTokens,
  saveGoogleTokens,
} from "@/lib/google/google-token-store";

/** Refresh when the cached access token is within this window of expiry. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * No real expiry is provided alongside Supabase's provider_token, so when we
 * capture it at sign-in we assume a conservative lifetime. The on-demand refresh
 * + 401 retry cover any premature expiry.
 */
const PROVIDER_TOKEN_ASSUMED_TTL_MS = 50 * 60 * 1000;

/**
 * Return a valid Google access token for the user, refreshing via the stored
 * refresh token when the cached token is missing, expired, or near expiry.
 *
 * Returns null when there is no way to produce a token (no stored refresh token
 * and no usable cache, or the refresh token was revoked) — callers should then
 * fall back to any session-provided token or prompt the user to reconnect.
 */
export async function getFreshGoogleAccessToken(
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<string | null> {
  const stored = await getStoredGoogleTokens(userId);
  if (!stored) return null;

  const now = Date.now();
  const cacheValid =
    stored.accessToken != null &&
    stored.expiresAt != null &&
    stored.expiresAt - now > REFRESH_SKEW_MS;

  if (!options?.forceRefresh && cacheValid) {
    return stored.accessToken;
  }

  if (!stored.refreshToken) {
    // Can't refresh. On a forced refresh (post-401) the cached token is already
    // known-bad, so signal "no token"; otherwise return whatever cache we have.
    return options?.forceRefresh ? null : stored.accessToken;
  }

  const result = await refreshGoogleAccessToken(stored.refreshToken);
  if (!result.ok) {
    if (result.reason === "invalid_grant") {
      await clearGoogleTokens(userId);
      return null;
    }
    // Transient/config failure — fall back to cache (may still work briefly).
    return options?.forceRefresh ? null : stored.accessToken;
  }

  await cacheGoogleAccessToken(userId, result.accessToken, result.expiresAt);
  return result.accessToken;
}

/** Detect a Gmail 401 / invalid-credentials error thrown by lib/gmail-api helpers. */
export function isGmailAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /failed:\s*401\b/.test(message) ||
    message.includes("UNAUTHENTICATED") ||
    message.includes("invalid authentication credentials") ||
    message.includes("Invalid Credentials")
  );
}

/**
 * Run a Gmail operation and, if it fails with a 401 auth error, force a token
 * refresh and retry exactly once. Both Gmail routes go through this so they
 * share the identical refreshed-token path.
 */
export async function withGoogleAuthRetry<T>(
  userId: string | null | undefined,
  accessToken: string,
  run: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await run(accessToken);
  } catch (error) {
    if (!userId || !isGmailAuthError(error)) throw error;

    const refreshed = await getFreshGoogleAccessToken(userId, { forceRefresh: true });
    if (!refreshed || refreshed === accessToken) throw error;

    return run(refreshed);
  }
}

/**
 * Persist Google tokens captured from a freshly exchanged Supabase session
 * (called from the OAuth code-exchange in proxy.ts). The refresh token is the
 * prize; the access token is cached with an assumed TTL.
 */
export async function persistGoogleTokensFromSession(
  session: Session | null | undefined,
): Promise<void> {
  const userId = session?.user?.id;
  if (!userId) return;

  const refreshToken = session?.provider_refresh_token ?? null;
  const accessToken = session?.provider_token ?? null;
  if (!refreshToken && !accessToken) return;

  try {
    await saveGoogleTokens(userId, {
      refreshToken,
      accessToken,
      expiresAt: accessToken ? Date.now() + PROVIDER_TOKEN_ASSUMED_TTL_MS : null,
    });
  } catch (error) {
    console.error("[google-token] persistGoogleTokensFromSession failed", error);
  }
}
