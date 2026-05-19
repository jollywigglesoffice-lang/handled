import { NextResponse } from "next/server";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import {
  loadFollowUpRemindersForUser,
  patchFollowUpReminder,
  SETUP_SQL,
  upsertFollowUpReminder,
} from "@/lib/follow-up-reminders/store";
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

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const reminders = await loadFollowUpRemindersForUser(auth.userId);
  return NextResponse.json({ reminders, setupSqlPath: SETUP_SQL });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: { analysis?: FollowUpAnalysis };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.analysis?.emailId) {
    return NextResponse.json({ error: "analysis required" }, { status: 400 });
  }

  const saved = await upsertFollowUpReminder(auth.userId, body.analysis);
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error, setupSqlPath: SETUP_SQL }, { status: 502 });
  }

  return NextResponse.json({ ok: true, reminder: saved.record, message: "Saved" });
}

export async function PATCH(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: {
    emailId?: string;
    action?: "snooze" | "dismiss" | "resolve";
    snoozeDays?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailId = body.emailId?.trim();
  if (!emailId || !body.action) {
    return NextResponse.json({ error: "emailId and action required" }, { status: 400 });
  }

  const snoozeDays = body.snoozeDays ?? 3;
  const patch =
    body.action === "snooze"
      ? {
          status: "snoozed" as const,
          snoozedUntil: new Date(
            Date.now() + snoozeDays * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }
      : body.action === "dismiss"
        ? { status: "dismissed" as const, snoozedUntil: null }
        : { status: "resolved" as const, snoozedUntil: null };

  const updated = await patchFollowUpReminder(auth.userId, emailId, patch);
  if (!updated.ok) {
    return NextResponse.json({ error: updated.error, setupSqlPath: SETUP_SQL }, { status: 502 });
  }

  const messages: Record<string, string> = {
    snooze: `Snoozed for ${snoozeDays} days.`,
    dismiss: "Reminder dismissed.",
    resolve: "Marked resolved.",
  };

  return NextResponse.json({
    ok: true,
    reminder: updated.record,
    message: messages[body.action],
  });
}
