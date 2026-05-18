import { NextResponse } from "next/server";
import type { SenderPreference } from "@/lib/inbox-sender-preferences";
import {
  loadSenderRulesForUser,
  saveSenderRulesForUser,
  SETUP_SQL,
} from "@/lib/sender-rules/store";
import { rulesToPreferences } from "@/lib/sender-rules/store";
import type { SenderRule } from "@/lib/sender-rules/types";
import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

function parseRulesBody(body: { rules?: SenderPreference[] }): SenderRule[] {
  const raw = body.rules ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => ({
    id: p.id || crypto.randomUUID(),
    senderEmail: p.senderEmail ?? "",
    senderDomain: p.senderDomain ?? "",
    targetCategory: normalizeInboxAiCategory(p.category),
    label: p.label,
    enabled: p.enabled !== false,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: p.updatedAt ?? Date.now(),
  }));
}

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const rules = await loadSenderRulesForUser(auth.userId);
  return NextResponse.json({
    rules: rulesToPreferences(rules),
    storageMode: "cloud",
    setupSqlPath: SETUP_SQL,
  });
}

export async function PUT(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: { rules?: SenderPreference[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rules = parseRulesBody(body);
  const saved = await saveSenderRulesForUser(auth.userId, rules);

  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, hint: saved.hint, setupSqlPath: SETUP_SQL },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    rules: rulesToPreferences(rules),
    storageMode: saved.storageMode,
    message: "Sender rules saved.",
  });
}

export async function DELETE(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get("id");
  if (!ruleId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await loadSenderRulesForUser(auth.userId);
  const next = existing.filter((r) => r.id !== ruleId);
  const saved = await saveSenderRulesForUser(auth.userId, next);

  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    rules: rulesToPreferences(next),
    deletedId: ruleId,
  });
}
