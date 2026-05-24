import { resolveApiAuth, type ResolvedApiAuth } from "@/lib/auth/resolve-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

/** Resolved auth for API route helpers (cookies or Bearer). */
export async function getApiSession(request: Request): Promise<ResolvedApiAuth | null> {
  const { supabase } = createRouteHandlerSupabase(request);
  if (!supabase) return null;
  const { auth } = await resolveApiAuth(request, supabase);
  return auth;
}
