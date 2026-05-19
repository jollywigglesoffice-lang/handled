import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { FollowUpReminderRecord, FollowUpReminderStatus } from "@/lib/follow-up/types";
import {
  isFollowUpRemindersTableMissingError,
  parseConversationState,
  parseReminderStatus,
  SETUP_SQL,
} from "@/lib/follow-up-reminders/storage";

export { SETUP_SQL };

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

function rowToRecord(row: {
  id: string;
  email_id: string;
  thread_id: string | null;
  conversation_state: string;
  urgency_score: number;
  reminder_title: string;
  reminder_body: string;
  status: string;
  snoozed_until: string | null;
  analysis_json: unknown;
  created_at: string;
  updated_at: string;
}): FollowUpReminderRecord {
  return {
    id: row.id,
    emailId: row.email_id,
    threadId: row.thread_id ?? undefined,
    conversationState: parseConversationState(row.conversation_state),
    urgencyScore: row.urgency_score,
    reminderTitle: row.reminder_title,
    reminderBody: row.reminder_body,
    status: parseReminderStatus(row.status),
    snoozedUntil: row.snoozed_until,
    analysis: row.analysis_json as FollowUpAnalysis | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadFollowUpRemindersForUser(
  userId: string,
): Promise<FollowUpReminderRecord[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("follow_up_reminders")
    .select(
      "id, email_id, thread_id, conversation_state, urgency_score, reminder_title, reminder_body, status, snoozed_until, analysis_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("urgency_score", { ascending: false });

  if (error) {
    if (isFollowUpRemindersTableMissingError(error.message)) return [];
    console.warn("[follow-up-reminders] load failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => rowToRecord(row as Parameters<typeof rowToRecord>[0]));
}

export async function upsertFollowUpReminder(
  userId: string,
  analysis: FollowUpAnalysis,
): Promise<{ ok: true; record: FollowUpReminderRecord } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("follow_up_reminders")
    .upsert(
      {
        user_id: userId,
        email_id: analysis.emailId,
        thread_id: analysis.threadId ?? null,
        conversation_state: analysis.state,
        urgency_score: analysis.urgencyScore,
        reminder_title: analysis.headline,
        reminder_body: analysis.calmPrompt,
        status: "active",
        snoozed_until: null,
        analysis_json: analysis,
        updated_at: now,
      },
      { onConflict: "user_id,email_id" },
    )
    .select(
      "id, email_id, thread_id, conversation_state, urgency_score, reminder_title, reminder_body, status, snoozed_until, analysis_json, created_at, updated_at",
    )
    .single();

  if (error) {
    if (isFollowUpRemindersTableMissingError(error.message)) {
      return {
        ok: false,
        error: "Run supabase/sql/follow_up_reminders.sql in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, record: rowToRecord(data as Parameters<typeof rowToRecord>[0]) };
}

export async function patchFollowUpReminder(
  userId: string,
  emailId: string,
  patch: {
    status?: FollowUpReminderStatus;
    snoozedUntil?: string | null;
  },
): Promise<{ ok: true; record: FollowUpReminderRecord } | { ok: false; error: string }> {
  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("follow_up_reminders")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.snoozedUntil !== undefined ? { snoozed_until: patch.snoozedUntil } : {}),
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("email_id", emailId)
    .select(
      "id, email_id, thread_id, conversation_state, urgency_score, reminder_title, reminder_body, status, snoozed_until, analysis_json, created_at, updated_at",
    )
    .maybeSingle();

  if (error || !data) {
    if (error && isFollowUpRemindersTableMissingError(error.message)) {
      return {
        ok: false,
        error: "Run supabase/sql/follow_up_reminders.sql in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error?.message ?? "Reminder not found" };
  }

  return { ok: true, record: rowToRecord(data as Parameters<typeof rowToRecord>[0]) };
}
