import { NextResponse } from "next/server";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

/** Check whether Google Calendar API token is available — no fake connection state. */
export async function GET(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;

  const tokenResult = await requireGoogleProviderToken(authResult.auth, { accountId });

  return applyAuthCookies(
    NextResponse.json({
      calendarConnected: tokenResult.ok,
      accountEmail: authResult.auth.user.email ?? null,
    }),
  );
}
