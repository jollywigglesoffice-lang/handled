import type { Session } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "@/lib/google/refresh-google-token";
import {
  cacheAccountAccessToken,
  clearAccountGoogleTokens,
  getAccountStoredTokens,
  getPrimaryGmailAccount,
  migrateLegacyTokensToConnectedAccount,
  syncPrimaryTokensToUsersTable,
  upsertConnectedGmailAccount,
} from "@/lib/google/connected-accounts";
import {
  cacheGoogleAccessToken,
  clearGoogleTokens,
  getStoredGoogleTokens,
  saveGoogleTokens,
} from "@/lib/google/google-token-store";

/** Refresh when the cached access token is within this window of expiry. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const PROVIDER_TOKEN_ASSUMED_TTL_MS = 50 * 60 * 1000;

async function resolveAccountId(
  userId: string,
  accountId?: string | null,
): Promise<string | null> {
  if (accountId) return accountId;
  const primary = await getPrimaryGmailAccount(userId);
  return primary?.id ?? null;
}

async function getTokensForAccount(
  userId: string,
  accountId: string | null,
): Promise<{
  refreshToken: string | null;
  accessToken: string | null;
  expiresAt: number | null;
  resolvedAccountId: string | null;
}> {
  await migrateLegacyTokensToConnectedAccount(userId);

  if (accountId) {
    const stored = await getAccountStoredTokens(userId, accountId);
    if (stored) {
      return { ...stored, resolvedAccountId: accountId };
    }
  }

  const primary = await getPrimaryGmailAccount(userId);
  if (primary) {
    const stored = await getAccountStoredTokens(userId, primary.id);
    if (stored) {
      return { ...stored, resolvedAccountId: primary.id };
    }
  }

  const legacy = await getStoredGoogleTokens(userId);
  return {
    refreshToken: legacy?.refreshToken ?? null,
    accessToken: legacy?.accessToken ?? null,
    expiresAt: legacy?.expiresAt ?? null,
    resolvedAccountId: primary?.id ?? null,
  };
}

/**
 * Return a valid Google access token for the user (optionally per connected account),
 * refreshing via the stored refresh token when needed.
 */
export async function getFreshGoogleAccessToken(
  userId: string,
  options?: { forceRefresh?: boolean; accountId?: string | null },
): Promise<string | null> {
  const accountId = await resolveAccountId(userId, options?.accountId);
  const stored = await getTokensForAccount(userId, accountId);
  if (!stored.refreshToken && !stored.accessToken) return null;

  const now = Date.now();
  const cacheValid =
    stored.accessToken != null &&
    stored.expiresAt != null &&
    stored.expiresAt - now > REFRESH_SKEW_MS;

  if (!options?.forceRefresh && cacheValid) {
    return stored.accessToken;
  }

  if (!stored.refreshToken) {
    return options?.forceRefresh ? null : stored.accessToken;
  }

  const result = await refreshGoogleAccessToken(stored.refreshToken);
  if (!result.ok) {
    if (result.reason === "invalid_grant") {
      if (stored.resolvedAccountId) {
        await clearAccountGoogleTokens(userId, stored.resolvedAccountId);
      }
      await clearGoogleTokens(userId);
      return null;
    }
    return options?.forceRefresh ? null : stored.accessToken;
  }

  if (stored.resolvedAccountId) {
    await cacheAccountAccessToken(
      userId,
      stored.resolvedAccountId,
      result.accessToken,
      result.expiresAt,
    );
    const primary = await getPrimaryGmailAccount(userId);
    if (primary?.id === stored.resolvedAccountId) {
      await cacheGoogleAccessToken(userId, result.accessToken, result.expiresAt);
    }
  } else {
    await cacheGoogleAccessToken(userId, result.accessToken, result.expiresAt);
  }

  return result.accessToken;
}

export function isGmailAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /failed:\s*401\b/.test(message) ||
    message.includes("UNAUTHENTICATED") ||
    message.includes("invalid authentication credentials") ||
    message.includes("Invalid Credentials")
  );
}

export async function withGoogleAuthRetry<T>(
  userId: string | null | undefined,
  accessToken: string,
  run: (token: string) => Promise<T>,
  options?: { accountId?: string | null },
): Promise<T> {
  try {
    return await run(accessToken);
  } catch (error) {
    if (!userId || !isGmailAuthError(error)) throw error;

    const refreshed = await getFreshGoogleAccessToken(userId, {
      forceRefresh: true,
      accountId: options?.accountId,
    });
    if (!refreshed || refreshed === accessToken) throw error;

    return run(refreshed);
  }
}

export async function persistGoogleTokensFromSession(
  session: Session | null | undefined,
): Promise<void> {
  const userId = session?.user?.id;
  if (!userId) return;

  const refreshToken = session?.provider_refresh_token ?? null;
  const accessToken = session?.provider_token ?? null;
  if (!refreshToken && !accessToken) return;

  try {
    const expiresAt = accessToken ? Date.now() + PROVIDER_TOKEN_ASSUMED_TTL_MS : null;
    await saveGoogleTokens(userId, {
      refreshToken,
      accessToken,
      expiresAt,
    });

    let email = session.user.email?.trim() ?? "";
    if (accessToken && !email) {
      try {
        const { gmailGetUserProfile } = await import("@/lib/gmail-api");
        email = (await gmailGetUserProfile(accessToken)).email;
      } catch {
        /* profile optional */
      }
    }

    if (email) {
      await upsertConnectedGmailAccount({
        userId,
        email,
        isPrimary: true,
        refreshToken,
        accessToken,
        expiresAt,
      });
      await syncPrimaryTokensToUsersTable(userId);
    }
  } catch (error) {
    console.error("[google-token] persistGoogleTokensFromSession failed", error);
  }
}
