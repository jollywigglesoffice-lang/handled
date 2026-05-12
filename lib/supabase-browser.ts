import { createBrowserClient } from "@supabase/ssr";

/**
 * Cookie-backed Supabase client so Route Handlers and Server Components
 * (via `createSupabaseServerClient`) see the same session as the browser.
 * A plain `createClient` + localStorage session never reaches `/api/*`.
 */
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
