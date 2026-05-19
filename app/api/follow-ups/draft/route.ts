import { NextResponse } from "next/server";
import { generateFollowUpDraft } from "@/lib/follow-up/draft";
import { parseConversationState } from "@/lib/follow-up-reminders/storage";
import type { ConversationState } from "@/lib/follow-up/types";
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

  return NextResponse.json({ draft });
}
