import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Server-only Supabase admin client. Returns null if env is missing or URL is invalid (e.g. during local setup). */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url.startsWith("http") || !key) {
    return null;
  }
  if (!cached) {
    cached = createClient(url, key);
  }
  return cached;
}
