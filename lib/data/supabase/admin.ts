import { createClient } from "@supabase/supabase-js";

/** Server-only Supabase admin client (service role). */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
