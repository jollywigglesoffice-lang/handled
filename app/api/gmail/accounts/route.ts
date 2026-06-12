import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { buildConnectGmailOAuthUrl } from "@/lib/google/account-oauth";
import {
  listConnectedGmailAccounts,
  migrateLegacyTokensToConnectedAccount,
} from "@/lib/google/connected-accounts";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const userId = authResult.auth.user.id;
  await migrateLegacyTokensToConnectedAccount(
    userId,
    authResult.auth.user.email,
  );
  const accounts = await listConnectedGmailAccounts(userId);

  return applyAuthCookies(NextResponse.json({ accounts }));
}

export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const url = buildConnectGmailOAuthUrl(authResult.auth.user.id);
  if (!url) {
    return applyAuthCookies(
      NextResponse.json(
        { error: "oauth_not_configured", message: "Google OAuth is not configured." },
        { status: 500 },
      ),
    );
  }

  return applyAuthCookies(NextResponse.json({ url }));
}
