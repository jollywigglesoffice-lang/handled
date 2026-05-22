import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url.startsWith("http") || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
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
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createSupabaseMiddlewareClient(request, supabaseResponse);
  if (!supabase) {
    return supabaseResponse;
  }

  const oauthCode = request.nextUrl.searchParams.get("code");
  if (pathname === "/auth/callback" && oauthCode) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const next = nextParam?.startsWith("/") ? nextParam : "/emails";
    const redirectResponse = NextResponse.redirect(new URL(next, request.url));
    const oauthSupabase = createSupabaseMiddlewareClient(request, redirectResponse);
    if (!oauthSupabase) {
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }
    const { error } = await oauthSupabase.auth.exchangeCodeForSession(oauthCode);
    if (error) {
      console.error("[middleware] exchangeCodeForSession", error);
      return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    }
    return redirectResponse;
  }

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip Stripe webhooks: no session cookies; avoids extra auth work. Vercel Deployment
    // Protection must still allow this path (see Stripe webhook URL / Vercel settings).
    "/((?!api/stripe-webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
