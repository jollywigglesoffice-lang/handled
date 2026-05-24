import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isProduction = process.env.NODE_ENV === "production";

/**
 * Cookie-backed Supabase client so Route Handlers and Server Components
 * (via `createSupabaseServerClient`) see the same session as the browser.
 */
export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    path: "/",
    sameSite: "lax",
    secure: isProduction,
  },
});
