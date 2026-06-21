import { NextResponse } from "next/server";
import { loadMemoryEngineForUser } from "@/lib/memory-engine/store";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const snapshot = await loadMemoryEngineForUser(authResult.auth.user.id);
  return applyAuthCookies(NextResponse.json(snapshot));
}
