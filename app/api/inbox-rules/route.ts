import { NextResponse } from "next/server";
import type { InboxUserRule } from "@/lib/inbox-user-rules";
import { INBOX_RULE_TEMPLATES, templateToRules } from "@/lib/inbox-rule-templates";
import {
  loadAllInboxUserRulesForUser,
  saveInboxUserRulesForUser,
} from "@/lib/inbox-user-rules/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SETUP_SQL_PATH = "supabase/sql/inbox_rules_setup.sql";

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

  const loaded = await loadAllInboxUserRulesForUser(auth.userId);

  return NextResponse.json({
    rules: loaded.rules,
    source: loaded.rules.length ? "saved" : "empty",
    storageMode: loaded.storageMode,
    dbAvailable: loaded.storageMode !== "none" || !loaded.dbError,
    dbError: loaded.dbError,
    setupSqlPath: SETUP_SQL_PATH,
    templates: INBOX_RULE_TEMPLATES.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      emoji: t.emoji,
    })),
  });
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
    return NextResponse.json(
      {
        error: saved.error,
        hint: saved.hint,
        setupSqlPath: SETUP_SQL_PATH,
        dbAvailable: false,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    rules,
    storageMode: saved.storageMode,
    message:
      saved.storageMode === "users_json_column"
        ? "Rules saved to your profile. Run inbox_rules_setup.sql in Supabase for full table storage."
        : "Rules saved.",
  });
}

/** Add template rules server-side (optional — UI also adds locally). */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let action = "add-template";
  let templateId: string | undefined;
  let incomingRules: InboxUserRule[] | undefined;

  try {
    const body = (await request.json()) as {
      action?: string;
      templateId?: string;
      rules?: InboxUserRule[];
    };
    action = body.action ?? "add-template";
    templateId = body.templateId;
    incomingRules = body.rules;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = (await loadAllInboxUserRulesForUser(auth.userId)).rules;

  let merged: InboxUserRule[];
  if (action === "save" && incomingRules) {
    merged = incomingRules;
  } else if (action === "add-template" && templateId) {
    const newRules = templateToRules(templateId);
    if (!newRules.length) {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }
    merged = [...existing, ...newRules];
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const saved = await saveInboxUserRulesForUser(auth.userId, merged);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, hint: saved.hint, setupSqlPath: SETUP_SQL_PATH },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    rules: merged,
    storageMode: saved.storageMode,
  });
}
