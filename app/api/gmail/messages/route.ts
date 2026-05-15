import { NextResponse } from "next/server";
import { categorizeGmailInboxRows } from "@/lib/categorize-inbox-messages";
import { gmailGetMessageMetadata, gmailListInboxIds } from "@/lib/gmail-api";
import { loadInboxUserRulesForUser } from "@/lib/inbox-user-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseWorkflowModeHeader } from "@/lib/workflow-mode-effects";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";

export async function GET(request: Request) {
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

    const userId = session.user.id;
    const userRules = userId ? await loadInboxUserRulesForUser(userId) : [];
    const workflowMode = parseWorkflowModeHeader(
      request.headers.get(WORKFLOW_MODE_HEADER),
    );
    const categorized = await categorizeGmailInboxRows(rows, {
      userRules,
      workflowMode,
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[api/gmail/messages] sample final categories for UI:",
        categorized.slice(0, 8).map((m) => ({
          subject: m.subject?.slice(0, 50),
          category: m.category,
          source: m.categorySource,
          confidence: m.categoryConfidence,
        })),
      );
    }

    return NextResponse.json({ messages: categorized });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Gmail request failed";
    console.error("[api/gmail/messages]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
