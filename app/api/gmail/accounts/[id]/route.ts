import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  disconnectGmailAccount,
  updateConnectedAccountLabel,
} from "@/lib/google/connected-accounts";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  let body: { label?: unknown };
  try {
    body = (await request.json()) as { label?: unknown };
  } catch {
    return applyAuthCookies(
      NextResponse.json({ error: "invalid_json" }, { status: 400 }),
    );
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) {
    return applyAuthCookies(
      NextResponse.json({ error: "label_required" }, { status: 400 }),
    );
  }

  const account = await updateConnectedAccountLabel(
    authResult.auth.user.id,
    id,
    label,
  );
  if (!account) {
    return applyAuthCookies(
      NextResponse.json({ error: "not_found" }, { status: 404 }),
    );
  }

  return applyAuthCookies(NextResponse.json({ ok: true, account }));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const ok = await disconnectGmailAccount(authResult.auth.user.id, id);
  if (!ok) {
    return applyAuthCookies(
      NextResponse.json({ error: "not_found" }, { status: 404 }),
    );
  }

  return applyAuthCookies(NextResponse.json({ ok: true }));
}
