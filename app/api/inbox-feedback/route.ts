import { NextResponse } from "next/server";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import { subjectKeywordsForSimilar } from "@/lib/category-correction";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { loadAllInboxUserRulesForUser, saveInboxUserRulesForUser } from "@/lib/inbox-user-rules/store";
import { ensureUuidRuleIds } from "@/lib/inbox-user-rules/storage";
import {
  mergeSenderPreferences,
  preferenceFromSender,
  type SenderPreference,
} from "@/lib/inbox-sender-preferences";
import {
  loadSenderPreferencesForUser,
  saveSenderPreferencesForUser,
} from "@/lib/inbox-sender-preferences-store";
import { parseSenderEmail } from "@/lib/inbox-user-rules/match";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SETUP_SQL = "supabase/sql/inbox_personalization_setup.sql";

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

function upsertSenderRule(
  rules: InboxUserRule[],
  sender: string,
  category: InboxAiCategory,
): InboxUserRule[] {
  const email = parseSenderEmail(sender) || sender.trim().toLowerCase();
  const domain = email.includes("@") ? email.split("@")[1] : "";
  const match =
    email.includes("@")
      ? ({ type: "sender_email" as const, value: email })
      : domain
        ? ({ type: "sender_domain" as const, value: domain })
        : ({ type: "sender_contains" as const, value: email });

  const withoutDup = rules.filter(
    (r) =>
      !(
        r.phase === "pre" &&
        r.action.type === "force_category" &&
        r.match.type === match.type &&
        r.match.value.toLowerCase() === match.value.toLowerCase()
      ),
  );

  const rule: InboxUserRule = {
    id: newRuleId(),
    enabled: true,
    priority: 300,
    phase: "pre",
    label: `Learned: ${email || sender}`,
    match,
    action: { type: "force_category", category },
  };

  return [rule, ...withoutDup];
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
    });
  }

  const existingPrefs = await loadSenderPreferencesForUser(auth.userId);
  const clientPrefs = body.clientPreferences ?? [];

  let prefsToSave = existingPrefs;
  if (scope === "sender") {
    const pref = preferenceFromSender(
      sender,
      category,
      `Always categorize as ${category.replace(/_/g, " ")}`,
    );
    prefsToSave = mergeSenderPreferences(prefsToSave, pref);
    for (const cp of clientPrefs) {
      prefsToSave = mergeSenderPreferences(prefsToSave, cp);
    }
  }

  const prefSave =
    scope === "sender" ? await saveSenderPreferencesForUser(auth.userId, prefsToSave) : { ok: true as const };

  const { rules: existingRules } = await loadAllInboxUserRulesForUser(auth.userId);
  let mergedRules = existingRules;

  if (scope === "sender") {
    mergedRules = upsertSenderRule(mergedRules, sender, category);
  } else if (scope === "similar" && body.subject) {
    mergedRules = upsertSimilarSubjectRule(mergedRules, body.subject, category);
  }

  mergedRules = ensureUuidRuleIds(mergedRules);
  const rulesSave =
    scope !== "this_email"
      ? await saveInboxUserRulesForUser(auth.userId, mergedRules)
      : { ok: true as const, storageMode: "client_local" as const };

  const messages: Record<CategoryApplyScope, string> = {
    this_email: "Updated for this email only.",
    sender: `Future emails from this sender will go to ${category.replace(/_/g, " ")}.`,
    similar: "Handled will match similar subject lines going forward.",
  };

  return NextResponse.json({
    ok: true,
    category,
    sender,
    scope,
    preferences: scope === "sender" ? prefsToSave : undefined,
    rules: scope !== "this_email" ? mergedRules : undefined,
    preferenceStorage:
      scope === "sender" && "storageMode" in prefSave
        ? prefSave.ok
          ? prefSave.storageMode
          : "client_local"
        : undefined,
    rulesStorage: rulesSave.ok ? ("storageMode" in rulesSave ? rulesSave.storageMode : "users_json_column") : "client_local",
    hint: undefined,
    setupSqlPath: SETUP_SQL,
    message: messages[scope],
  });
}

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const prefs = await loadSenderPreferencesForUser(auth.userId);
  return NextResponse.json({ preferences: prefs });
}
