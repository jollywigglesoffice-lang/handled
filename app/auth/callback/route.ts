import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { syncPublicUserFromAuth } from "@/lib/sync-public-user";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next");
  const next = nextRaw?.startsWith("/") ? nextRaw : "/emails";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!supabaseUrl.startsWith("http") || !supabaseAnon) {
    console.error("[auth/callback] missing Supabase env");
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  let response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.redirect(new URL(next, url.origin));
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession", error);
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const { error: syncError } = await syncPublicUserFromAuth(user.id, user.email ?? null);
    if (syncError) {
      console.error("[auth/callback] syncPublicUserFromAuth", syncError);
    }
  }

  return response;
}
