import { NextResponse } from "next/server";
import { generateFollowUpDraft } from "@/lib/follow-up/draft";
import { parseConversationState } from "@/lib/follow-up-reminders/storage";
import type { ConversationState } from "@/lib/follow-up/types";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  let body: {
    sender?: string;
    subject?: string;
    snippet?: string;
    state?: string;
    userName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const state: ConversationState = body.state
    ? parseConversationState(body.state)
    : "follow_up_recommended";

  const draft = await generateFollowUpDraft({
    row: {
      sender: body.sender ?? "",
      subject: body.subject ?? "",
      snippet: body.snippet ?? "",
    },
    state,
    userName: body.userName,
  });

  return applyAuthCookies(NextResponse.json({ draft }));
}
