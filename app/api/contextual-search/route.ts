import { NextResponse } from "next/server";
import { searchContextualMemory } from "@/lib/contextual-search";
import type { ContextualSearchMessage } from "@/lib/contextual-search";
import type { HandledBrain } from "@/lib/handled-brain/types";
import { parseHandledBrainHeader } from "@/lib/handled-brain/client-storage";
import { HANDLED_BRAIN_HEADER } from "@/lib/handled-brain/client-storage";
import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchBody = {
  query?: string;
  activeFilter?: string | null;
  locale?: "en" | "it";
  messages?: Array<{
    id: string;
    threadId?: string;
    sender: string;
    subject: string;
    snippet: string;
    date?: string;
    internalDateMs?: number;
    category?: string;
    relationship?: ContextualSearchMessage["relationship"];
    aiSummary?: string;
    timelineIntelligence?: ContextualSearchMessage["timelineIntelligence"];
  }>;
  brain?: HandledBrain;
};

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

  let body: SearchBody;
  try {
    body = (await request.json()) as SearchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query : "";
  const locale = body.locale === "it" ? "it" : "en";
  const headerBrain = parseHandledBrainHeader(
    request.headers.get(HANDLED_BRAIN_HEADER),
  );
  const brain = body.brain ?? headerBrain ?? null;

  const messages: ContextualSearchMessage[] = (body.messages ?? []).map((m) => ({
    id: m.id,
    threadId: m.threadId,
    sender: m.sender,
    subject: m.subject,
    snippet: m.snippet,
    date: m.date,
    internalDateMs: m.internalDateMs,
    category: normalizeInboxAiCategory(m.category ?? "worth_your_attention"),
    relationship: m.relationship,
    aiSummary: m.aiSummary,
    timelineIntelligence: m.timelineIntelligence,
  }));

  const result = searchContextualMemory({
    query,
    messages,
    locale,
    activeFilter:
      body.activeFilter && typeof body.activeFilter === "string"
        ? (body.activeFilter as import("@/lib/contextual-search").SmartSearchFilter)
        : null,
    brain,
  });

  return NextResponse.json({ result });
}
