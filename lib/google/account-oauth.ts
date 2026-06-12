import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getOAuthRedirectOrigin } from "@/lib/auth/app-origin";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "openid",
  "email",
  "profile",
].join(" ");

type OAuthStatePayload = {
  userId: string;
  nonce: string;
  ts: number;
};

function oauthStateSecret(): string | null {
  return (
    process.env.TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export function signAccountOAuthState(userId: string): string | null {
  const secret = oauthStateSecret();
  if (!secret) return null;

  const payload: OAuthStatePayload = {
    userId,
    nonce: randomBytes(16).toString("hex"),
    ts: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyAccountOAuthState(
  state: string,
): OAuthStatePayload | null {
  const secret = oauthStateSecret();
  if (!secret) return null;

  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    if (!payload.userId || !payload.nonce) return null;
    if (Date.now() - payload.ts > 15 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildConnectGmailOAuthUrl(userId: string): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const state = signAccountOAuthState(userId);
  if (!clientId || !state) return null;

  const origin = getOAuthRedirectOrigin();
  const redirectUri = `${origin}/api/gmail/accounts/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleCodeExchangeResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string | null;
      expiresAt: number;
      email: string;
    }
  | { ok: false; reason: string };

export async function exchangeGoogleAuthCode(
  code: string,
): Promise<GoogleCodeExchangeResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { ok: false, reason: "config" };
  }

  const origin = getOAuthRedirectOrigin();
  const redirectUri = `${origin}/api/gmail/accounts/callback`;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  let res: Response;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[account-oauth] code exchange failed", res.status, text);
    return { ok: false, reason: "exchange_failed" };
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    return { ok: false, reason: "missing_token" };
  }

  const { gmailGetUserProfile } = await import("@/lib/gmail-api");
  const profile = await gmailGetUserProfile(data.access_token);
  if (!profile.email) {
    return { ok: false, reason: "profile_failed" };
  }

  const ttl = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    ok: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + ttl * 1000,
    email: profile.email,
  };
}
