import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { persistGoogleTokensFromSession } from "@/lib/google/google-access-token";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

/** Persist Google OAuth tokens server-side after login — Node runtime only. */
export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  try {
    await persistGoogleTokensFromSession(authResult.auth.session);
    return applyAuthCookies(NextResponse.json({ ok: true }));
  } catch (error) {
    console.error("[api/auth/persist-google-tokens]", error);
    return applyAuthCookies(
      NextResponse.json({ error: "persist_failed" }, { status: 500 }),
    );
  }
}
