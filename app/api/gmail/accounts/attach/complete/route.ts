import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  ATTACH_INBOX_COOKIE,
  verifyAttachInboxToken,
} from "@/lib/auth/attach-inbox-token";
import {
  syncPrimaryTokensToUsersTable,
  upsertConnectedGmailAccount,
} from "@/lib/google/connected-accounts";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

const PROVIDER_TOKEN_ASSUMED_TTL_MS = 50 * 60 * 1000;

function readAttachCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq);
    if (name !== ATTACH_INBOX_COOKIE) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return null;
}

/**
 * Finish attach flow: save Google tokens for the signed-in Handled user without
 * switching their Supabase session (client restores parent session after).
 */
export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const attachCookie = readAttachCookie(request);
  const parentUserId = attachCookie ? verifyAttachInboxToken(attachCookie) : null;
  if (!parentUserId) {
    return applyAuthCookies(
      NextResponse.json(
        { error: "attach_expired", message: "Inbox attach expired — try again." },
        { status: 400 },
      ),
    );
  }

  let body: {
    providerToken?: string | null;
    providerRefreshToken?: string | null;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* optional body */
  }

  const accessToken =
    body.providerToken?.trim() ||
    authResult.auth.providerToken?.trim() ||
    null;
  const refreshToken =
    body.providerRefreshToken?.trim() ||
    authResult.auth.session.provider_refresh_token?.trim() ||
    null;

  if (!accessToken && !refreshToken) {
    return applyAuthCookies(
      NextResponse.json(
        { error: "missing_tokens", message: "Google did not return inbox access." },
        { status: 400 },
      ),
    );
  }

  let email = authResult.auth.user.email?.trim() ?? "";
  if (accessToken) {
    try {
      const { gmailGetUserProfile } = await import("@/lib/gmail-api");
      email = (await gmailGetUserProfile(accessToken)).email || email;
    } catch {
      /* profile optional */
    }
  }

  if (!email) {
    return applyAuthCookies(
      NextResponse.json(
        { error: "profile_failed", message: "Could not identify the Gmail account." },
        { status: 400 },
      ),
    );
  }

  const account = await upsertConnectedGmailAccount({
    userId: parentUserId,
    email,
    isPrimary: false,
    refreshToken,
    accessToken,
    expiresAt: accessToken ? Date.now() + PROVIDER_TOKEN_ASSUMED_TTL_MS : null,
  });

  if (!account) {
    return applyAuthCookies(
      NextResponse.json(
        { error: "save_failed", message: "Could not save the inbox." },
        { status: 500 },
      ),
    );
  }

  await syncPrimaryTokensToUsersTable(parentUserId);

  const response = NextResponse.json({ ok: true, account });
  response.cookies.set(ATTACH_INBOX_COOKIE, "", { path: "/", maxAge: 0 });
  return applyAuthCookies(response);
}
