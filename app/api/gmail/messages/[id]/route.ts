import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gmailGetMessageFull } from "@/lib/gmail-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.provider_token;
  if (!accessToken) {
    return NextResponse.json({ error: "missing_google_token" }, { status: 403 });
  }

  try {
    const msg = await gmailGetMessageFull(accessToken, id);
    return NextResponse.json(msg);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Gmail request failed";
    console.error("[api/gmail/messages/[id]]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
