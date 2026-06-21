import { NextResponse } from "next/server";
import { analyzeFollowUpBatch } from "@/lib/follow-up/analyze";
import { mergeFollowUpItems } from "@/lib/follow-up-reminders/merge";
import { loadFollowUpRemindersForUser } from "@/lib/follow-up-reminders/store";
import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import { parseWorkflowModeHeader } from "@/lib/workflow-mode-effects";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";
import { loadCategorizationContext } from "@/lib/load-user-categorization-context";
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
    messages?: Array<{
      id: string;
      sender: string;
      subject: string;
      snippet: string;
      date?: string;
      internalDateMs?: number;
      category?: string;
    }>;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workflowMode = parseWorkflowModeHeader(
    request.headers.get(WORKFLOW_MODE_HEADER),
  );

  const rows = (body.messages ?? []).map((m) => ({
    id: m.id,
    threadId: (m as { threadId?: string }).threadId ?? m.id,
    sender: m.sender,
    subject: m.subject,
    snippet: m.snippet ?? "",
    date: m.date ?? "",
    internalDateMs: m.internalDateMs ?? 0,
    category: normalizeInboxAiCategory(m.category ?? "worth_your_attention"),
  }));

  const rulesCtx = await loadCategorizationContext(session.user.id, request);
  const analyses = analyzeFollowUpBatch(rows, workflowMode, rulesCtx.senderRelationships);
  const persisted = await loadFollowUpRemindersForUser(session.user.id);
  const items = mergeFollowUpItems(analyses, persisted);

  return NextResponse.json({ items, analyses });
}
