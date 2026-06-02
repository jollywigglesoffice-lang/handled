import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_DEBUG_ENABLED,
  logAuthDebug,
  type AuthDebugSnapshot,
} from "@/lib/auth/debug-log";
import {
  listSupabaseAuthCookieNames,
  readRequestCookieEntries,
} from "@/lib/auth/request-cookies";

const SKIP_AUTH_REFRESH_PREFIXES = ["/api/stripe-webhook"];

function canonicalProductionHost(host: string | null): string | null {
  if (!host || process.env.NODE_ENV !== "production") return null;
  if (host.startsWith("www.")) {
    return host.slice(4);
  }
  return null;
}

function createSupabaseProxyClient(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url.startsWith("http") || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        const fromNext = request.cookies.getAll();
        if (fromNext.length > 0) return fromNext;
        return readRequestCookieEntries(request);
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        if (headers) {
          for (const [hKey, hVal] of Object.entries(headers)) {
            response.headers.set(hKey, hVal);
          }
        }
      },
    },
  });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host");

  const canonicalHost = canonicalProductionHost(host);
  if (canonicalHost) {
    const url = request.nextUrl.clone();
    url.host = canonicalHost;
    return NextResponse.redirect(url, 308);
  }

  if (SKIP_AUTH_REFRESH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createSupabaseProxyClient(request, supabaseResponse);
  if (!supabase) {
    if (AUTH_DEBUG_ENABLED && pathname.startsWith("/api/")) {
      console.warn("[auth-debug] proxy: Supabase env missing");
    }
    return supabaseResponse;
  }

  const oauthCode = request.nextUrl.searchParams.get("code");
  if (pathname === "/auth/callback" && oauthCode) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const next = nextParam?.startsWith("/") ? nextParam : "/emails";
    const redirectResponse = NextResponse.redirect(new URL(next, request.url));
    const oauthSupabase = createSupabaseProxyClient(request, redirectResponse);
    if (!oauthSupabase) {
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }
    const { data, error } = await oauthSupabase.auth.exchangeCodeForSession(oauthCode);
    if (error) {
      console.error("[proxy] exchangeCodeForSession", error);
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }
    // Capture the Google refresh token now — Supabase only surfaces
    // provider_refresh_token at exchange time and never refreshes it for us.
    try {
      const { persistGoogleTokensFromSession } = await import(
        "@/lib/google/google-access-token"
      );
      await persistGoogleTokensFromSession(data.session);
    } catch (persistError) {
      console.error("[proxy] persist Google tokens failed", persistError);
    }
    return redirectResponse;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (AUTH_DEBUG_ENABLED && pathname.startsWith("/api/")) {
    const entries = readRequestCookieEntries(request);
    const snapshot: Partial<AuthDebugSnapshot> = {
      path: pathname,
      host,
      hasCookieHeader: Boolean(request.headers.get("cookie")),
      cookieCount: entries.length,
      supabaseAuthCookieNames: listSupabaseAuthCookieNames(entries),
      cookieUserId: user?.id ?? null,
      cookieUserError: userError?.message ?? null,
    };
    logAuthDebug("proxy", snapshot);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
