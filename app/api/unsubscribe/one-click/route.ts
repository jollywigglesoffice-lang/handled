import { NextResponse } from "next/server";
import { gmailGetMessageFull, performOneClickUnsubscribe } from "@/lib/gmail-api";
import { parseListUnsubscribeHeader, supportsOneClickPost } from "@/lib/unsubscribe/parse-headers";
import { assessUnsubscribeUrlSafety } from "@/lib/unsubscribe/safety";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.provider_token;
  if (!accessToken) {
    return NextResponse.json({ error: "missing_google_token" }, { status: 403 });
  }

  let body: { messageId?: string; url?: string; confirmed?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.confirmed) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  const messageId = body.messageId?.trim();
  const url = body.url?.trim();
  if (!messageId || !url) {
    return NextResponse.json({ error: "messageId and url required" }, { status: 400 });
  }

  const safety = assessUnsubscribeUrlSafety(url);
  if (!safety.safe) {
    return NextResponse.json(
      {
        error: "unsafe_url",
        message: "This link did not pass safety checks. Open the email and unsubscribe manually.",
        reason: safety.reason,
      },
      { status: 400 },
    );
  }

  try {
    const msg = await gmailGetMessageFull(accessToken, messageId);
    const parsed = parseListUnsubscribeHeader(msg.listUnsubscribe ?? "");
    const allowed = parsed.https.some((u) => u === url);
    if (!allowed) {
      return NextResponse.json(
        { error: "url_mismatch", message: "URL does not match this message's List-Unsubscribe header." },
        { status: 400 },
      );
    }

    if (!supportsOneClickPost(msg.listUnsubscribePost)) {
      return NextResponse.json(
        {
          error: "one_click_not_supported",
          message: "One-click is not available for this sender. Use the external page instead.",
        },
        { status: 400 },
      );
    }

    const result = await performOneClickUnsubscribe(url);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "unsubscribe_failed",
          message: "The sender's server did not confirm unsubscribe. Try the link in the email.",
          status: result.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Unsubscribe request sent. It may take a few days to stop receiving mail.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gmail request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
