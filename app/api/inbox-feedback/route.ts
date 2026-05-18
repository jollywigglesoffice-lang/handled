import { NextResponse } from "next/server";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import { subjectKeywordsForSimilar } from "@/lib/category-correction";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { loadAllInboxUserRulesForUser, saveInboxUserRulesForUser } from "@/lib/inbox-user-rules/store";
import { ensureUuidRuleIds } from "@/lib/inbox-user-rules/storage";
import { preferenceFromSender, type SenderPreference } from "@/lib/inbox-sender-preferences";
import {
  loadSenderRulesForUser,
  saveSenderRulesForUser,
  rulesToPreferences,
} from "@/lib/sender-rules/store";
import { parseSenderEmail } from "@/lib/inbox-user-rules/match";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SETUP_SQL = "supabase/sql/sender_rules.sql";

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

function newRuleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}`;
}

function upsertSimilarSubjectRule(
  rules: InboxUserRule[],
  subject: string,
  category: InboxAiCategory,
): InboxUserRule[] {
  const keywords = subjectKeywordsForSimilar(subject);
  if (!keywords) return rules;

  const rule: InboxUserRule = {
    id: newRuleId(),
    enabled: true,
    priority: 200,
    phase: "pre",
    label: `Similar: ${keywords.slice(0, 40)}`,
    match: { type: "keywords_contains", value: keywords },
    action: { type: "force_category", category },
  };

  return [rule, ...rules];
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: {
    action?: string;
    sender?: string;
    subject?: string;
    snippet?: string;
    emailId?: string;
    category?: string;
    guessedCategory?: string;
    scope?: CategoryApplyScope;
    alwaysForSender?: boolean;
    clientPreferences?: SenderPreference[];
    clientRules?: InboxUserRule[];
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sender = body.sender?.trim();
  const category = normalizeInboxAiCategory(body.category ?? "needs_attention");
  const action = body.action ?? "correct_category";
  const scope: CategoryApplyScope = body.scope ?? (body.alwaysForSender ? "sender" : "this_email");

  if (!sender) {
    return NextResponse.json({ error: "sender required" }, { status: 400 });
  }

  if (action === "correct_category" && scope === "this_email") {
    return NextResponse.json({
      ok: true,
      category,
      scope,
      message: "Updated for this email only.",
      affectedCount: 1,
    });
  }

  let prefsToSave = await loadSenderRulesForUser(auth.userId);
  let preferences: SenderPreference[] = rulesToPreferences(prefsToSave);

  if (scope === "sender") {
    const pref = preferenceFromSender(
      sender,
      category,
      `Always categorize as ${category.replace(/_/g, " ")}`,
    );
    prefsToSave = [
      {
        id: pref.id,
        senderEmail: pref.senderEmail,
        senderDomain: pref.senderDomain,
        targetCategory: category,
        label: pref.label,
        enabled: true,
        createdAt: pref.createdAt,
        updatedAt: Date.now(),
      },
      ...prefsToSave.filter(
        (p) =>
          p.senderEmail !== pref.senderEmail &&
          (p.senderDomain !== pref.senderDomain || !pref.senderDomain),
      ),
    ];
    for (const cp of body.clientPreferences ?? []) {
      prefsToSave = [
        {
          id: cp.id,
          senderEmail: cp.senderEmail,
          senderDomain: cp.senderDomain,
          targetCategory: cp.category,
          label: cp.label,
          enabled: cp.enabled !== false,
          createdAt: cp.createdAt,
          updatedAt: Date.now(),
        },
        ...prefsToSave.filter((p) => p.id !== cp.id),
      ];
    }
    preferences = rulesToPreferences(prefsToSave);
  }

  const prefSave =
    scope === "sender"
      ? await saveSenderRulesForUser(auth.userId, prefsToSave)
      : { ok: true as const, storageMode: "sender_rules_table" as const };

  const { rules: existingRules } = await loadAllInboxUserRulesForUser(auth.userId);
  let mergedRules = existingRules;

  if (scope === "similar" && body.subject) {
    mergedRules = upsertSimilarSubjectRule(mergedRules, body.subject, category);
  }

  mergedRules = ensureUuidRuleIds(mergedRules);
  const rulesSave =
    scope === "similar"
      ? await saveInboxUserRulesForUser(auth.userId, mergedRules)
      : { ok: true as const, storageMode: "client_local" as const };

  const senderEmail = parseSenderEmail(sender);
  const messages: Record<CategoryApplyScope, string> = {
    this_email: "Updated for this email only.",
    sender: `Always categorize emails from ${senderEmail || sender} as ${category.replace(/_/g, " ")}.`,
    similar: "Handled will match similar subject lines going forward.",
  };

  return NextResponse.json({
    ok: true,
    category,
    sender,
    scope,
    preferences: scope === "sender" ? preferences : undefined,
    rules: scope === "similar" ? mergedRules : undefined,
    preferenceStorage:
      scope === "sender" && "storageMode" in prefSave
        ? prefSave.ok
          ? prefSave.storageMode
          : "client_local"
        : undefined,
    rulesStorage:
      scope === "similar" && rulesSave.ok
        ? "storageMode" in rulesSave
          ? rulesSave.storageMode
          : "users_json_column"
        : undefined,
    setupSqlPath: SETUP_SQL,
    message: messages[scope],
    learnedSender: scope === "sender",
  });
}

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const rules = await loadSenderRulesForUser(auth.userId);
  return NextResponse.json({ preferences: rulesToPreferences(rules) });
}
