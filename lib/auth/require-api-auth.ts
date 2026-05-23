import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthSessionFromClient, type ServerAuthSession } from "@/lib/auth/server-session";

export type ApiAuthResult =
  | { ok: true; auth: ServerAuthSession }
  | { ok: false; response: NextResponse };

/** Validated session from an existing Supabase server/route-handler client. */
export async function requireApiAuth(
  supabase: SupabaseClient | null,
): Promise<ApiAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }),
    };
  }

  const auth = await getServerAuthSessionFromClient(supabase);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", authRequired: true },
        { status: 401 },
      ),
    };
  }

  return { ok: true, auth };
}

export function requireGoogleProviderToken(
  auth: ServerAuthSession,
  extra?: Record<string, unknown>,
): ApiAuthResult | { ok: true } {
  if (auth.providerToken) {
    return { ok: true };
  }
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "missing_google_token",
        authRequired: true,
        reason: "connect_gmail",
        ...extra,
      },
      { status: 403 },
    ),
  };
}
