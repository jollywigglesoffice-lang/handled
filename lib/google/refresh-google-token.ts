/** Exchange a Google refresh token for a fresh access token (server-only). */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Default Google access-token lifetime if the response omits expires_in. */
const FALLBACK_TTL_SECONDS = 3600;

export type GoogleRefreshSuccess = {
  ok: true;
  accessToken: string;
  /** Epoch milliseconds at which the access token expires. */
  expiresAt: number;
};

export type GoogleRefreshFailure = {
  ok: false;
  /**
   * - "config": missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
   * - "invalid_grant": refresh token revoked/expired → user must reconnect
   * - "request_failed": transient/network/Google error → safe to retry later
   */
  reason: "config" | "invalid_grant" | "request_failed";
};

export type GoogleRefreshResult = GoogleRefreshSuccess | GoogleRefreshFailure;

/**
 * Mint a new Google access token from a stored refresh token. Requires the same
 * OAuth client credentials configured for Google in the Supabase dashboard,
 * exposed to the server as GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleRefreshResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    console.error(
      "[google-token] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — cannot refresh Google access token",
    );
    return { ok: false, reason: "config" };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let res: Response;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[google-token] refresh request failed", error);
    return { ok: false, reason: "request_failed" };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // invalid_grant means the refresh token is dead (revoked, expired, or the
    // user removed app access) — the only fix is reconnecting Google.
    if (text.includes("invalid_grant")) {
      return { ok: false, reason: "invalid_grant" };
    }
    console.error(`[google-token] refresh failed: ${res.status} ${text}`);
    return { ok: false, reason: "request_failed" };
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    console.error("[google-token] refresh response missing access_token");
    return { ok: false, reason: "request_failed" };
  }

  const ttl = typeof data.expires_in === "number" ? data.expires_in : FALLBACK_TTL_SECONDS;
  return {
    ok: true,
    accessToken: data.access_token,
    expiresAt: Date.now() + ttl * 1000,
  };
}
