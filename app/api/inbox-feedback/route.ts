import { NextResponse } from "next/server";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import { loadAllInboxUserRulesForUser, saveInboxUserRulesForUser } from "@/lib/inbox-user-rules/store";
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

  const ruleId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `rule-${Date.now()}`;
  const rule: InboxUserRule = {
    id: ruleId,
    enabled: true,
    priority: 300,
    phase: "pre",
    label: `Learned: ${email || sender}`,
    match,
    action: { type: "force_category", category },
  };

  return [rule, ...withoutDup];
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: {
    action?: string;
    sender?: string;
    category?: string;
    subject?: string;
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
  const action = body.action ?? "remember_sender_category";

  if (!sender) {
    return NextResponse.json({ error: "sender required" }, { status: 400 });
  }

  const existingPrefs = await loadSenderPreferencesForUser(auth.userId);
  const clientPrefs = body.clientPreferences ?? [];

  let prefsToSave = existingPrefs;
  if (action === "remember_sender_category" || body.alwaysForSender !== false) {
    const pref = preferenceFromSender(
      sender,
      category,
      `Always categorize as ${category.replace(/_/g, " ")}`,
    );
    prefsToSave = mergeSenderPreferences(prefsToSave, pref);
  }
  for (const cp of clientPrefs) {
    prefsToSave = mergeSenderPreferences(prefsToSave, cp);
  }

  const prefSave = await saveSenderPreferencesForUser(auth.userId, prefsToSave);

  const { rules: existingRules } = await loadAllInboxUserRulesForUser(auth.userId);
  const withLearnedRule = upsertSenderRule(existingRules, sender, category);
  const rulesSave = await saveInboxUserRulesForUser(auth.userId, withLearnedRule);

  return NextResponse.json({
    ok: true,
    category,
    sender,
    preferences: prefsToSave,
    rules: withLearnedRule,
    preferenceStorage: prefSave.ok ? prefSave.storageMode : "client_local",
    rulesStorage: rulesSave.ok ? rulesSave.storageMode : "client_local",
    hint: !prefSave.ok ? prefSave.hint : !rulesSave.ok ? rulesSave.hint : undefined,
    setupSqlPath: SETUP_SQL,
    message:
      prefSave.ok && rulesSave.ok
        ? "Handled will remember this sender."
        : "Saved on this device — run setup SQL in Supabase for cloud sync.",
  });
}

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const prefs = await loadSenderPreferencesForUser(auth.userId);
  return NextResponse.json({ preferences: prefs });
}
