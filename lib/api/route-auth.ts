import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export type RouteAuth = {
  userId: string;
  applyAuthCookies: (response: NextResponse) => NextResponse;
};

/** Route Handler auth — same path as /api/gmail/messages (cookies + Bearer). */
export async function requireRouteAuth(
  request: Request,
): Promise<RouteAuth | { error: NextResponse }> {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return { error: applyAuthCookies(authResult.response) };
  }
  return {
    userId: authResult.auth.user.id,
    applyAuthCookies,
  };
}
