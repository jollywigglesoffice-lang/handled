import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { readRequestCookieEntries } from "@/lib/auth/request-cookies";

export type RouteHandlerSupabase = {
  supabase: SupabaseClient | null;
  /** Copy refreshed Supabase auth cookies onto the route response. */
  applyAuthCookies: (response: NextResponse) => NextResponse;
};

function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url.startsWith("http") || !key) return null;
  return { url, key };
}

/**
 * Supabase client for Route Handlers that can refresh sessions and write
 * Set-Cookie on the JSON response (cookies().set() alone often fails here).
 */
export function createRouteHandlerSupabase(request: Request): RouteHandlerSupabase {
  const env = supabaseEnv();
  if (!env) {
    return {
      supabase: null,
      applyAuthCookies: (response) => response,
    };
  }

  const nextRequest =
    request instanceof NextRequest ? request : new NextRequest(request.url, request);

  let cookieCarrier = NextResponse.next({ request: nextRequest });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        const fromNext = nextRequest.cookies.getAll();
        if (fromNext.length > 0) {
          return fromNext;
        }
        return readRequestCookieEntries(request);
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          nextRequest.cookies.set(name, value);
        });
        cookieCarrier = NextResponse.next({ request: nextRequest });
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieCarrier.cookies.set(name, value, options);
        });
        if (headers) {
          for (const [hKey, hVal] of Object.entries(headers)) {
            cookieCarrier.headers.set(hKey, hVal);
          }
        }
      },
    },
  });

  return {
    supabase,
    applyAuthCookies(response: NextResponse) {
      for (const cookie of cookieCarrier.cookies.getAll()) {
        response.cookies.set(cookie);
      }
      return response;
    },
  };
}
