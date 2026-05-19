import { normalizeInboxAiCategory, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  isEmailOverridesTableMissingError,
  SETUP_SQL,
} from "@/lib/email-overrides/storage";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";

export { SETUP_SQL };

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

function rowToOverride(row: {
  email_id: string;
  original_category: string | null;
  overridden_category: string;
  created_at: string;
  updated_at: string;
}): EmailCategoryOverride {
  return {
    emailId: row.email_id,
    originalCategory:
      row.original_category?.trim()
        ? normalizeInboxAiCategory(row.original_category)
        : null,
    overriddenCategory: normalizeInboxAiCategory(row.overridden_category),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadEmailOverridesForUser(
  userId: string,
): Promise<EmailCategoryOverride[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_overrides")
    .select("email_id, original_category, overridden_category, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isEmailOverridesTableMissingError(error.message)) return [];
    console.warn("[email-overrides] load failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    rowToOverride(
      row as {
        email_id: string;
        original_category: string | null;
        overridden_category: string;
        created_at: string;
        updated_at: string;
      },
    ),
  );
}

export async function loadEmailOverrideForMessage(
  userId: string,
  emailId: string,
): Promise<EmailCategoryOverride | null> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_overrides")
    .select("email_id, original_category, overridden_category, created_at, updated_at")
    .eq("user_id", userId)
    .eq("email_id", emailId)
    .maybeSingle();

  if (error || !data) {
    if (error && !isEmailOverridesTableMissingError(error.message)) {
      console.warn("[email-overrides] load one failed:", error.message);
    }
    return null;
  }

  return rowToOverride(
    data as {
      email_id: string;
      original_category: string | null;
      overridden_category: string;
      created_at: string;
      updated_at: string;
    },
  );
}

export async function saveEmailOverrideForUser(
  userId: string,
  input: {
    emailId: string;
    overriddenCategory: InboxAiCategory;
    originalCategory?: InboxAiCategory | null;
  },
): Promise<{ ok: true; override: EmailCategoryOverride } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("email_overrides")
    .upsert(
      {
        user_id: userId,
        email_id: input.emailId,
        original_category: input.originalCategory ?? null,
        overridden_category: input.overriddenCategory,
        updated_at: now,
      },
      { onConflict: "user_id,email_id" },
    )
    .select("email_id, original_category, overridden_category, created_at, updated_at")
    .single();

  if (error) {
    if (isEmailOverridesTableMissingError(error.message)) {
      return {
        ok: false,
        error: "Run supabase/sql/email_overrides.sql in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    override: rowToOverride(
      data as {
        email_id: string;
        original_category: string | null;
        overridden_category: string;
        created_at: string;
        updated_at: string;
      },
    ),
  };
}

export async function deleteEmailOverrideForUser(
  userId: string,
  emailId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from("email_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("email_id", emailId);

  if (error) {
    if (isEmailOverridesTableMissingError(error.message)) {
      return {
        ok: false,
        error: "Run supabase/sql/email_overrides.sql in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
