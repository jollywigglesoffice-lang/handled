import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { syncPublicUserFromAuth } from "@/lib/sync-public-user";

/** Production only: OAuth must not complete on localhost or preview hosts. */
const PRODUCTION_ORIGIN = "https://handledemails.com";
const OAUTH_SUCCESS_PATH = "/emails";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!supabaseUrl.startsWith("http") || !supabaseAnon) {
    console.error("[auth/callback] missing Supabase env");
    return NextResponse.redirect(new URL("/login?error=oauth", PRODUCTION_ORIGIN));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", PRODUCTION_ORIGIN));
  }

  let response = NextResponse.redirect(new URL(OAUTH_SUCCESS_PATH, PRODUCTION_ORIGIN));

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.redirect(new URL(OAUTH_SUCCESS_PATH, PRODUCTION_ORIGIN));
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession", error);
    return NextResponse.redirect(new URL("/login?error=oauth", PRODUCTION_ORIGIN));
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
