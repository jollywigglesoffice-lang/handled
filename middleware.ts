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
import { buildLoginRedirectUrl, isAppPath } from "@/lib/auth/route-access";

const SKIP_AUTH_REFRESH_PREFIXES = ["/api/stripe-webhook"];

/** Marketing home — no session reads, no auth enforcement. */
const PUBLIC_SKIP_PATHS = new Set(["/"]);

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

export async function middleware(request: NextRequest) {
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

  if (PUBLIC_SKIP_PATHS.has(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createSupabaseMiddlewareClient(request, response);
  if (!supabase) {
    if (AUTH_DEBUG_ENABLED && pathname.startsWith("/api/")) {
      console.warn("[auth-debug] middleware: Supabase env missing");
    }
    return response;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user && isAppPath(pathname)) {
    return NextResponse.redirect(buildLoginRedirectUrl(request.nextUrl, pathname));
  }

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
    logAuthDebug("middleware", snapshot);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
