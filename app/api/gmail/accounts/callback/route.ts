import { NextResponse } from "next/server";
import { getOAuthRedirectOrigin } from "@/lib/auth/app-origin";
import {
  exchangeGoogleAuthCode,
  verifyAccountOAuthState,
} from "@/lib/google/account-oauth";
import {
  syncPrimaryTokensToUsersTable,
  upsertConnectedGmailAccount,
} from "@/lib/google/connected-accounts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const origin = getOAuthRedirectOrigin();
  const settingsUrl = `${origin}/settings?connected=1#connected-accounts`;

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?connect_error=missing_params`);
  }

  const payload = verifyAccountOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(`${origin}/settings?connect_error=invalid_state`);
  }

  const exchanged = await exchangeGoogleAuthCode(code);
  if (!exchanged.ok) {
    return NextResponse.redirect(`${origin}/settings?connect_error=${exchanged.reason}`);
  }

  const account = await upsertConnectedGmailAccount({
    userId: payload.userId,
    email: exchanged.email,
    refreshToken: exchanged.refreshToken,
    accessToken: exchanged.accessToken,
    expiresAt: exchanged.expiresAt,
  });

  if (!account) {
    return NextResponse.redirect(`${origin}/settings?connect_error=save_failed`);
  }

  await syncPrimaryTokensToUsersTable(payload.userId);

  return NextResponse.redirect(settingsUrl);
}
