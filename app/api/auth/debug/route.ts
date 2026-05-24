import { NextResponse } from "next/server";
import { AUTH_DEBUG_ENABLED } from "@/lib/auth/debug-log";
import { resolveApiAuth } from "@/lib/auth/resolve-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

/**
 * Temporary production diagnostics — enable with AUTH_DEBUG=1 on Vercel.
 * GET /api/auth/debug (while signed in) shows cookie/session state (no secrets).
 */
export async function GET(request: Request) {
  if (!AUTH_DEBUG_ENABLED) {
    return NextResponse.json({ error: "Auth debug disabled" }, { status: 404 });
  }

  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Server misconfigured",
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      },
      { status: 500 },
    );
  }

  const { auth, debug } = await resolveApiAuth(request, supabase);

  return applyAuthCookies(
    NextResponse.json({
      ok: true,
      authenticated: Boolean(auth),
      userId: auth?.user.id ?? null,
      authSource: auth?.source ?? null,
      hasProviderToken: Boolean(auth?.providerToken),
      debug,
    }),
  );
}
