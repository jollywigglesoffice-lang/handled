import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gmailGetMessageMetadata, gmailListInboxIds } from "@/lib/gmail-api";

export async function GET() {
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
    return NextResponse.json(
      {
        error: "missing_google_token",
        message: "Sign in with Google to load your Gmail inbox.",
      },
      { status: 403 },
    );
  }

  try {
    const ids = await gmailListInboxIds(accessToken, 20);
    const rows = await Promise.all(
      ids.map((m) => gmailGetMessageMetadata(accessToken, m.id)),
    );
    rows.sort((a, b) => b.internalDateMs - a.internalDateMs);

    return NextResponse.json({ messages: rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Gmail request failed";
    console.error("[api/gmail/messages]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
