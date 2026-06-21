import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
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
