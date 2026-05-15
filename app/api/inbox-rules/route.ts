import { NextResponse } from "next/server";
import type { InboxUserRule } from "@/lib/inbox-user-rules";
import { INBOX_RULE_TEMPLATES, templateToRules } from "@/lib/inbox-rule-templates";
import { defaultInboxUserRules } from "@/lib/inbox-user-rules/presets";
import {
  loadAllInboxUserRulesForUser,
  saveInboxUserRulesForUser,
  seedInboxUserRulesForUser,
} from "@/lib/inbox-user-rules/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
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

/** List inbox priority rules for the signed-in user. */
export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  try {
    const rules = await loadAllInboxUserRulesForUser(auth.userId);
    return NextResponse.json({
      rules,
      source: rules.length ? "database" : "empty",
      dbAvailable: true,
      examplePresets: defaultInboxUserRules(),
      templates: INBOX_RULE_TEMPLATES.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        emoji: t.emoji,
      })),
    });
  } catch (e) {
    console.error("[api/inbox-rules] GET failed", e);
    return NextResponse.json({
      rules: [],
      source: "error",
      dbAvailable: false,
      error: e instanceof Error ? e.message : "load failed",
    });
  }
}

/** Replace all inbox rules for the signed-in user. */
export async function PUT(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: { rules?: InboxUserRule[] };
  try {
    body = (await request.json()) as { rules?: InboxUserRule[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rules = body.rules;
  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: "rules array required" }, { status: 400 });
  }

  const saved = await saveInboxUserRulesForUser(auth.userId, rules);
  if (!saved.ok) {
    console.error("[api/inbox-rules] PUT failed", saved.error);
    return NextResponse.json({ error: saved.error, dbAvailable: false }, { status: 502 });
  }

  return NextResponse.json({ ok: true, rules });
}

/** Seed starter rules when the user has none. */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let action = "seed";
  let templateId: string | undefined;
  try {
    const body = (await request.json()) as { action?: string; templateId?: string };
    action = body.action ?? "seed";
    templateId = body.templateId;
  } catch {
    // empty body → seed
  }

  if (action === "add-template" && templateId) {
    const newRules = templateToRules(templateId);
    if (!newRules.length) {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }
    const existing = await loadAllInboxUserRulesForUser(auth.userId);
    const merged = [...existing, ...newRules];
    const saved = await saveInboxUserRulesForUser(auth.userId, merged);
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, rules: merged });
  }

  if (action !== "seed") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const result = await seedInboxUserRulesForUser(auth.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, rules: result.rules });
}
