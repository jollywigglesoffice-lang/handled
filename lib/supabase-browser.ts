import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/** Browser Supabase client (anon key only). Uses placeholders when env is unset so the module loads during builds. */
export const supabaseBrowser = createClient(
  url.startsWith("http") ? url : "https://placeholder.supabase.co",
  key || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder",
);
