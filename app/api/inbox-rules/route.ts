import { NextResponse } from "next/server";
import { defaultInboxUserRules } from "@/lib/inbox-user-rules/presets";
import { dbRowToUserRule, type InboxRuleRowDb } from "@/lib/inbox-user-rules/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** List inbox priority rules for the signed-in user (DB + built-in presets when empty). */
export async function GET() {
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

  try {
    const { data, error } = await supabase
      .from("inbox_rules")
      .select("*")
      .eq("user_id", session.user.id)
      .order("priority", { ascending: false });

    if (error) {
      return NextResponse.json({
        rules: defaultInboxUserRules(),
        source: "presets",
        dbAvailable: false,
      });
    }

    const rules = (data ?? [])
      .map((row) => dbRowToUserRule(row as InboxRuleRowDb))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({
      rules: rules.length ? rules : defaultInboxUserRules(),
      source: rules.length ? "database" : "presets",
      dbAvailable: true,
    });
  } catch {
    return NextResponse.json({
      rules: defaultInboxUserRules(),
      source: "presets",
      dbAvailable: false,
    });
  }
}
