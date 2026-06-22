import { NextRequest, NextResponse } from "next/server";
import { AUTH_DEBUG_ENABLED, logAuthDebug } from "@/lib/auth/debug-log";
import {
  listSupabaseAuthCookieNames,
  readRequestCookieEntries,
} from "@/lib/auth/request-cookies";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

/**
 * Server-side OAuth code exchange — sets Supabase auth cookies on the response
 * before the app shell loads, so middleware can read the session on the next hop.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");

  if (!code) {
    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug("auth-callback-route", {
        path: url.pathname,
        failureReason: "no_code_rewrite_to_client",
      });
    }
    const clientUrl = url.clone();
    clientUrl.pathname = "/auth/callback/client";
    return NextResponse.rewrite(clientUrl);
  }

  const attach = url.searchParams.get("attach");
  const isAttachFlow = attach === "true" || attach === "1";
  const nextParam = url.searchParams.get("next");
  const next =
    nextParam?.startsWith("/")
      ? nextParam
      : isAttachFlow
        ? "/emails?inbox_added=1"
        : "/emails";

  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  if (!supabase) {
    console.error("[auth/callback/route] Supabase env missing");
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback/route] exchangeCodeForSession", error);
    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug("auth-callback-route", {
        path: url.pathname,
        cookieUserError: error.message,
        failureReason: "exchange_failed",
      });
    }
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", "oauth");
    if (isAttachFlow) {
      return NextResponse.redirect(new URL("/emails?attach_error=oauth", url.origin));
    }
    return NextResponse.redirect(login);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const finishUrl = new URL("/auth/callback/client", url.origin);
  finishUrl.searchParams.set("next", next);
  if (isAttachFlow) {
    finishUrl.searchParams.set("attach", "true");
  }

  if (AUTH_DEBUG_ENABLED) {
    const entries = readRequestCookieEntries(request);
    logAuthDebug("auth-callback-route", {
      path: url.pathname,
      cookieUserId: user?.id ?? null,
      cookieCount: entries.length,
      supabaseAuthCookieNames: listSupabaseAuthCookieNames(entries),
      failureReason: null,
    });
  }

  return applyAuthCookies(NextResponse.redirect(finishUrl));
}
