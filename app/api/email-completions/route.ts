import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/api/route-auth";
import { recordCompletionLearning } from "@/lib/completion-learning/record";
import { parseCompletionLearningJson } from "@/lib/completion-learning/record";
import type { CompletionLearningStats } from "@/lib/completion-learning/types";
import { parseEmailCompletionsJson } from "@/lib/email-completions/client-storage";
import {
  loadEmailCompletionsForUser,
  saveEmailCompletionsForUser,
  SETUP_SQL,
} from "@/lib/email-completions/store";
import type { EmailCompletionMap, EmailCompletionRecord } from "@/lib/email-completions/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

export async function GET(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  const { completions, learning } = await loadEmailCompletionsForUser(auth.userId);
  return auth.applyAuthCookies(
    NextResponse.json({ completions, learning, setupSqlPath: SETUP_SQL }),
  );
}

export async function POST(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  let body: { records?: EmailCompletionRecord[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    );
  }

  const incoming = body.records ?? [];
  const { completions: existing, learning: existingLearning } =
    await loadEmailCompletionsForUser(auth.userId);

  let completions: EmailCompletionMap = { ...existing };
  let learning: CompletionLearningStats = existingLearning;

  for (const raw of incoming) {
    if (!raw?.emailId || !raw.actionId) continue;
    const domain = raw.senderDomain ?? resolveSenderIdentity(raw.sender).domain ?? undefined;
    const record: EmailCompletionRecord = {
      emailId: raw.emailId,
      actionId: raw.actionId,
      actionLabel: raw.actionLabel ?? raw.actionId,
      completedAt: raw.completedAt ?? Date.now(),
      sender: raw.sender ?? "",
      subject: raw.subject ?? "",
      snippet: raw.snippet,
      category: raw.category ?? "needs_attention",
      senderDomain: domain,
    };
    completions[record.emailId] = record;
    learning = recordCompletionLearning(learning, record);
  }

  const saved = await saveEmailCompletionsForUser(auth.userId, completions, learning);

  if (!saved.ok) {
    return auth.applyAuthCookies(
      NextResponse.json(
        {
          error: saved.error,
          clientLocalOk: saved.clientLocalOk ?? false,
          completions,
        },
        { status: saved.clientLocalOk ? 200 : 500 },
      ),
    );
  }

  return auth.applyAuthCookies(
    NextResponse.json({ ok: true, completions, learning }),
  );
}

export async function PUT(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  let body: { completions?: unknown; learning?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    );
  }

  const completions = parseEmailCompletionsJson(body.completions);
  const learning = parseCompletionLearningJson(body.learning);
  const saved = await saveEmailCompletionsForUser(auth.userId, completions, learning);

  if (!saved.ok) {
    return auth.applyAuthCookies(
      NextResponse.json(
        { error: saved.error, clientLocalOk: saved.clientLocalOk ?? false },
        { status: saved.clientLocalOk ? 200 : 500 },
      ),
    );
  }

  return auth.applyAuthCookies(NextResponse.json({ ok: true }));
}
