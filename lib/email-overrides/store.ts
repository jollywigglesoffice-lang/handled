import { normalizeInboxAiCategory, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  isEmailOverridesTableMissingError,
  mergeEmailOverrides,
  parseEmailOverridesJson,
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

async function loadFromJsonColumn(userId: string): Promise<EmailCategoryOverride[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("email_overrides_json")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[email-overrides] json load failed:", error.message);
    return [];
  }

  return parseEmailOverridesJson(data?.email_overrides_json);
}

async function saveToJsonColumn(
  userId: string,
  overrides: EmailCategoryOverride[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    email_overrides_json: overrides,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
    if (isEmailOverridesTableMissingError(error.message)) {
      return loadFromJsonColumn(userId);
    }
    console.warn("[email-overrides] load failed:", error.message);
    return loadFromJsonColumn(userId);
  }

  const fromTable = (data ?? []).map((row) =>
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

  if (fromTable.length > 0) return fromTable;

  const legacy = await loadFromJsonColumn(userId);
  if (legacy.length) {
    void saveEmailOverridesBulk(userId, legacy);
  }
  return legacy;
}

async function saveEmailOverridesBulk(
  userId: string,
  overrides: EmailCategoryOverride[],
): Promise<void> {
  for (const o of overrides) {
    await saveEmailOverrideForUser(userId, {
      emailId: o.emailId,
      overriddenCategory: o.overriddenCategory,
      originalCategory: o.originalCategory,
    });
  }
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
      const override: EmailCategoryOverride = {
        emailId: input.emailId,
        originalCategory: input.originalCategory ?? null,
        overriddenCategory: input.overriddenCategory,
        createdAt: now,
        updatedAt: now,
      };
      const existing = await loadFromJsonColumn(userId);
      const merged = mergeEmailOverrides(existing, [override]);
      const jsonSaved = await saveToJsonColumn(userId, merged);
      if (jsonSaved.ok) {
        return { ok: true, override };
      }
      return {
        ok: false,
        error: jsonSaved.error,
      };
    }
    return { ok: false, error: error.message };
  }

  const savedOverride = rowToOverride(
    data as {
      email_id: string;
      original_category: string | null;
      overridden_category: string;
      created_at: string;
      updated_at: string;
    },
  );

  void saveToJsonColumn(
    userId,
    mergeEmailOverrides(await loadFromJsonColumn(userId), [savedOverride]),
  ).catch(() => {});

  return { ok: true, override: savedOverride };
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
      const existing = await loadFromJsonColumn(userId);
      const next = existing.filter((o) => o.emailId !== emailId);
      const jsonSaved = await saveToJsonColumn(userId, next);
      return jsonSaved.ok ? { ok: true } : { ok: false, error: jsonSaved.error };
    }
    return { ok: false, error: error.message };
  }

  const existing = await loadFromJsonColumn(userId);
  const next = existing.filter((o) => o.emailId !== emailId);
  void saveToJsonColumn(userId, next).catch(() => {});

  return { ok: true };
}
