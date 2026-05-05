import { createClient } from "@supabase/supabase-js";

/** Single shared browser Supabase client (anon key). */
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
