import { supabase } from "@/lib/supabase";
import { decryptSecret, encryptSecret } from "@/lib/crypto/token-cipher";

/**
 * Persistence for Google OAuth tokens on public.users (service-role only).
 * The refresh token is the source of truth; the access token + expiry are a
 * server-side cache so we don't hit Google's token endpoint on every request.
 *
 * Requires the columns added by supabase/sql/google_oauth_tokens.sql.
 */

export type StoredGoogleTokens = {
  refreshToken: string | null;
  accessToken: string | null;
  /** Epoch milliseconds, or null if unknown. */
  expiresAt: number | null;
};

type UsersTokenRow = {
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expires_at: string | null;
};

export async function getStoredGoogleTokens(
  userId: string,
): Promise<StoredGoogleTokens | null> {
  const { data, error } = await supabase
    .from("users")
    .select("google_refresh_token, google_access_token, google_token_expires_at")
    .eq("id", userId)
    .maybeSingle<UsersTokenRow>();

  if (error) {
    console.error("[google-token-store] getStoredGoogleTokens", error.message);
    return null;
  }
  if (!data) return null;

  return {
    refreshToken: data.google_refresh_token ? decryptSecret(data.google_refresh_token) : null,
    accessToken: data.google_access_token ? decryptSecret(data.google_access_token) : null,
    expiresAt: data.google_token_expires_at
      ? new Date(data.google_token_expires_at).getTime()
      : null,
  };
}

/**
 * Upsert whatever token fields we have. A null/undefined field is left
 * untouched so a later sign-in that doesn't return a refresh token (Google only
 * returns it on first consent) won't wipe the stored one.
 */
export async function saveGoogleTokens(
  userId: string,
  tokens: {
    refreshToken?: string | null;
    accessToken?: string | null;
    expiresAt?: number | null;
  },
): Promise<void> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  await syncPublicUserFromAuth(userId);

  const row: Record<string, unknown> = { id: userId };
  if (tokens.refreshToken) {
    row.google_refresh_token = encryptSecret(tokens.refreshToken);
  }
  if (tokens.accessToken) {
    row.google_access_token = encryptSecret(tokens.accessToken);
  }
  if (tokens.expiresAt) {
    row.google_token_expires_at = new Date(tokens.expiresAt).toISOString();
  }

  const { error } = await supabase.from("users").upsert(row, { onConflict: "id" });
  if (error) {
    console.error("[google-token-store] saveGoogleTokens", error.message);
  }
}

/** Update only the cached access token + expiry (after a refresh). */
export async function cacheGoogleAccessToken(
  userId: string,
  accessToken: string,
  expiresAt: number,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({
      google_access_token: encryptSecret(accessToken),
      google_token_expires_at: new Date(expiresAt).toISOString(),
    })
    .eq("id", userId);
  if (error) {
    console.error("[google-token-store] cacheGoogleAccessToken", error.message);
  }
}

/** Wipe Google tokens (e.g. after invalid_grant) so the user is prompted to reconnect. */
export async function clearGoogleTokens(userId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({
      google_refresh_token: null,
      google_access_token: null,
      google_token_expires_at: null,
    })
    .eq("id", userId);
  if (error) {
    console.error("[google-token-store] clearGoogleTokens", error.message);
  }
}
