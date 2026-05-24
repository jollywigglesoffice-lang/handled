import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_DEBUG_ENABLED } from "@/lib/auth/debug-log";
import { resolveApiAuth, type ResolvedApiAuth } from "@/lib/auth/resolve-api-auth";
import type { ServerAuthSession } from "@/lib/auth/server-session";

export type ApiAuthResult =
  | { ok: true; auth: ServerAuthSession | ResolvedApiAuth }
  | { ok: false; response: NextResponse };

/** Validated session from cookies and/or Authorization Bearer. */
export async function requireApiAuth(
  request: Request,
  supabase: SupabaseClient | null,
): Promise<ApiAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }),
    };
  }

  const { auth, debug } = await resolveApiAuth(request, supabase);
  if (!auth) {
    const body: Record<string, unknown> = {
      error: "Unauthorized",
      authRequired: true,
    };
    if (AUTH_DEBUG_ENABLED) {
      body._authDebug = debug;
    }
    return {
      ok: false,
      response: NextResponse.json(body, { status: 401 }),
    };
  }

  return { ok: true, auth };
}

export function requireGoogleProviderToken(
  auth: ServerAuthSession | ResolvedApiAuth,
  extra?: Record<string, unknown>,
): ApiAuthResult | { ok: true } {
  if (auth.providerToken) {
    return { ok: true };
  }
  const body: Record<string, unknown> = {
    error: "missing_google_token",
    authRequired: true,
    reason: "connect_gmail",
    ...extra,
  };
  if (AUTH_DEBUG_ENABLED) {
    body._authDebug = { failureReason: "missing_google_provider_token" };
  }
  return {
    ok: false,
    response: NextResponse.json(body, { status: 403 }),
  };
}
