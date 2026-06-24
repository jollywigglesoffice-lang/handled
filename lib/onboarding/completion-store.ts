import { syncPublicUserFromAuth } from "@/lib/sync-public-user";

export const SETUP_SQL = "supabase/sql/onboarding_completed_setup.sql";

export type OnboardingCompletionSource =
  | "database"
  | "database_missing_column"
  | "database_error"
  | "default_false";

export type OnboardingCompletionRecord = {
  completed: boolean;
  source: OnboardingCompletionSource;
  rawValue: boolean | null;
};

/** Only explicit true means complete — undefined/null/false → incomplete. */
export function normalizeOnboardingCompleted(value: unknown): boolean {
  return value === true;
}

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export async function loadOnboardingCompletedForUser(
  userId: string,
): Promise<OnboardingCompletionRecord> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    const missingColumn = error.message.toLowerCase().includes("onboarding_completed");
    console.warn("[onboarding-completion] load failed:", error.message, { userId });
    return {
      completed: false,
      source: missingColumn ? "database_missing_column" : "database_error",
      rawValue: null,
    };
  }

  const rawValue =
    data?.onboarding_completed === true
      ? true
      : data?.onboarding_completed === false
        ? false
        : null;

  return {
    completed: normalizeOnboardingCompleted(data?.onboarding_completed),
    source: "database",
    rawValue,
  };
}

export async function saveOnboardingCompletedForUser(
  userId: string,
  completed: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("users").upsert({
    id: userId,
    onboarding_completed: completed,
  });

  if (error) {
    if (error.message.toLowerCase().includes("onboarding_completed")) {
      return {
        ok: false,
        error: `Run ${SETUP_SQL} in Supabase SQL Editor.`,
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
