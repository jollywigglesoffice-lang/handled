import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  ATTACH_INBOX_COOKIE,
  attachInboxCookieOptions,
  signAttachInboxToken,
} from "@/lib/auth/attach-inbox-token";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

/** Begin multi-account attach — sets a short-lived cookie for the parent user. */
export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const token = signAttachInboxToken(authResult.auth.user.id);
  if (!token) {
    return applyAuthCookies(
      NextResponse.json(
        { error: "attach_not_configured", message: "Could not start inbox attach." },
        { status: 500 },
      ),
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ATTACH_INBOX_COOKIE, token, attachInboxCookieOptions());
  return applyAuthCookies(response);
}
