import { NextRequest, NextResponse } from "next/server";
import { AUTH_DEBUG_ENABLED, logAuthDebug } from "@/lib/auth/debug-log";
import {
  listSupabaseAuthCookieNames,
  readRequestCookieEntries,
} from "@/lib/auth/request-cookies";
import { POST_LOGIN_DESTINATION } from "@/lib/auth/post-login-destination";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

/**
 * OAuth callback — exchange code, verify session, redirect ONCE to inbox.
 * No client routing logic.
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

  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  if (!supabase) {
    console.error("[auth/callback/route] Supabase env missing");
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback/route] exchangeCodeForSession", error);
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", "oauth");
    return NextResponse.redirect(login);
  }

  let verifiedUserId: string | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      verifiedUserId = user.id;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 60 * (attempt + 1)));
  }

  if (!verifiedUserId) {
    console.error("[auth/callback/route] session not verified after code exchange");
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const destination = isAttachFlow
    ? `${POST_LOGIN_DESTINATION}?inbox_added=1`
    : POST_LOGIN_DESTINATION;

  if (AUTH_DEBUG_ENABLED) {
    const entries = readRequestCookieEntries(request);
    logAuthDebug("auth-callback-route", {
      path: url.pathname,
      cookieUserId: verifiedUserId,
      cookieCount: entries.length,
      supabaseAuthCookieNames: listSupabaseAuthCookieNames(entries),
      failureReason: null,
      redirectDecision: destination,
    });
  }

  return applyAuthCookies(NextResponse.redirect(new URL(destination, url.origin)));
}
