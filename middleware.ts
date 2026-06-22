/**
 * Edge middleware — auth checks, redirects, session validation ONLY.
 * See ARCHITECTURE.md. Do not import domain, data, crypto, or Gmail modules here.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_DEBUG_ENABLED,
  logAuthDebug,
  type AuthDebugSnapshot,
} from "@/lib/auth/debug-log";
import {
  getMiddlewareAuthSkipReason,
  isAppPath,
  shouldSkipMiddlewareAuth,
} from "@/lib/auth/middleware-access";
import {
  listSupabaseAuthCookieNames,
  readRequestCookieEntries,
} from "@/lib/auth/request-cookies";
import { buildLoginRedirectUrl } from "@/lib/auth/route-access";

function canonicalProductionHost(host: string | null): string | null {
  if (!host || process.env.NODE_ENV !== "production") return null;
  if (host.startsWith("www.")) {
    return host.slice(4);
  }
  return null;
}

function createSupabaseMiddlewareClient(request: NextRequest, response: NextResponse) {
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

function copyAuthCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value);
  }
}

function logMiddlewareDecision(
  pathname: string,
  host: string | null,
  snapshot: Partial<AuthDebugSnapshot> & { redirectDecision?: string },
): void {
  if (!AUTH_DEBUG_ENABLED) return;
  logAuthDebug("middleware", {
    path: pathname,
    host,
    ...snapshot,
  });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host");

  const canonicalHost = canonicalProductionHost(host);
  if (canonicalHost) {
    const url = request.nextUrl.clone();
    url.host = canonicalHost;
    return NextResponse.redirect(url, 308);
  }

  const skipReason = getMiddlewareAuthSkipReason(pathname);
  if (shouldSkipMiddlewareAuth(pathname)) {
    logMiddlewareDecision(pathname, host, {
      redirectDecision: `allow:${skipReason ?? "exempt"}`,
      failureReason: null,
    });
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createSupabaseMiddlewareClient(request, response);
  if (!supabase) {
    logMiddlewareDecision(pathname, host, {
      redirectDecision: "allow:supabase_env_missing",
      failureReason: "supabase_env_missing",
    });
    return response;
  }

  const entries = readRequestCookieEntries(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const hasSession = Boolean(user?.id);

  if (!hasSession && isAppPath(pathname)) {
    logMiddlewareDecision(pathname, host, {
      hasCookieHeader: Boolean(request.headers.get("cookie")),
      cookieCount: entries.length,
      supabaseAuthCookieNames: listSupabaseAuthCookieNames(entries),
      cookieUserId: null,
      cookieUserError: userError?.message ?? null,
      redirectDecision: "redirect:app_path_without_session",
      failureReason: "no_session_on_app_path",
    });

    const redirectResponse = NextResponse.redirect(
      buildLoginRedirectUrl(request.nextUrl, pathname),
    );
    copyAuthCookies(response, redirectResponse);
    return redirectResponse;
  }

  logMiddlewareDecision(pathname, host, {
    hasCookieHeader: Boolean(request.headers.get("cookie")),
    cookieCount: entries.length,
    supabaseAuthCookieNames: listSupabaseAuthCookieNames(entries),
    cookieUserId: user?.id ?? null,
    cookieUserError: userError?.message ?? null,
    redirectDecision: hasSession ? "allow:session_ok" : "allow:public_or_non_app",
    failureReason: null,
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
