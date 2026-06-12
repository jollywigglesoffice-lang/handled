import { decryptSecret, encryptSecret } from "@/lib/crypto/token-cipher";
import {
  defaultAccountLabel,
  type ConnectedGmailAccount,
} from "@/lib/gmail/account-types";
import { supabase } from "@/lib/supabase";
import {
  getStoredGoogleTokens,
  saveGoogleTokens,
  type StoredGoogleTokens,
} from "@/lib/google/google-token-store";

type AccountRow = {
  id: string;
  user_id: string;
  email: string;
  label: string | null;
  is_primary: boolean;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expires_at: string | null;
  connected_at: string;
};

function rowToAccount(row: AccountRow): ConnectedGmailAccount {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    label: row.label?.trim() || defaultAccountLabel(row.email),
    isPrimary: row.is_primary,
    connectedAt: row.connected_at,
  };
}

export async function listConnectedGmailAccounts(
  userId: string,
  fallbackEmail?: string | null,
): Promise<ConnectedGmailAccount[]> {
  await migrateLegacyTokensToConnectedAccount(userId, fallbackEmail);

  const { data, error } = await supabase
    .from("connected_gmail_accounts")
    .select("id, user_id, email, label, is_primary, connected_at")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("connected_at", { ascending: true });

  if (error) {
    if (error.code === "PGRST205" || /could not find the table/i.test(error.message)) {
      console.error(
        "[connected-accounts] TABLE MISSING — run supabase/sql/connected_gmail_accounts.sql. " +
          "Falling back to empty account list; inbox will fail with no_accounts.",
      );
    } else {
      console.error("[connected-accounts] list failed", error.code, error.message);
    }
    return [];
  }

  return (data ?? []).map((row) => rowToAccount(row as AccountRow));
}

export async function getConnectedGmailAccount(
  userId: string,
  accountId: string,
): Promise<ConnectedGmailAccount | null> {
  const { data, error } = await supabase
    .from("connected_gmail_accounts")
    .select("id, user_id, email, label, is_primary, connected_at")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle<AccountRow>();

  if (error || !data) return null;
  return rowToAccount(data);
}

export async function getPrimaryGmailAccount(
  userId: string,
): Promise<ConnectedGmailAccount | null> {
  const accounts = await listConnectedGmailAccounts(userId);
  return accounts.find((a) => a.isPrimary) ?? accounts[0] ?? null;
}

export async function getAccountStoredTokens(
  userId: string,
  accountId: string,
): Promise<StoredGoogleTokens | null> {
  const { data, error } = await supabase
    .from("connected_gmail_accounts")
    .select("google_refresh_token, google_access_token, google_token_expires_at")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle<Pick<
      AccountRow,
      "google_refresh_token" | "google_access_token" | "google_token_expires_at"
    >>();

  if (error || !data) return null;

  return {
    refreshToken: data.google_refresh_token
      ? decryptSecret(data.google_refresh_token)
      : null,
    accessToken: data.google_access_token
      ? decryptSecret(data.google_access_token)
      : null,
    expiresAt: data.google_token_expires_at
      ? new Date(data.google_token_expires_at).getTime()
      : null,
  };
}

export async function saveAccountGoogleTokens(
  userId: string,
  accountId: string,
  tokens: {
    refreshToken?: string | null;
    accessToken?: string | null;
    expiresAt?: number | null;
  },
): Promise<void> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (tokens.refreshToken) {
    row.google_refresh_token = encryptSecret(tokens.refreshToken);
  }
  if (tokens.accessToken) {
    row.google_access_token = encryptSecret(tokens.accessToken);
  }
  if (tokens.expiresAt) {
    row.google_token_expires_at = new Date(tokens.expiresAt).toISOString();
  }

  const { error } = await supabase
    .from("connected_gmail_accounts")
    .update(row)
    .eq("user_id", userId)
    .eq("id", accountId);

  if (error) {
    console.error("[connected-accounts] saveAccountGoogleTokens", error.message);
  }
}

export async function cacheAccountAccessToken(
  userId: string,
  accountId: string,
  accessToken: string,
  expiresAt: number,
): Promise<void> {
  await saveAccountGoogleTokens(userId, accountId, { accessToken, expiresAt });
}

export async function clearAccountGoogleTokens(
  userId: string,
  accountId: string,
): Promise<void> {
  const { error } = await supabase
    .from("connected_gmail_accounts")
    .update({
      google_refresh_token: null,
      google_access_token: null,
      google_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", accountId);

  if (error) {
    console.error("[connected-accounts] clearAccountGoogleTokens", error.message);
  }
}

export async function upsertConnectedGmailAccount(input: {
  userId: string;
  email: string;
  label?: string | null;
  isPrimary?: boolean;
  refreshToken?: string | null;
  accessToken?: string | null;
  expiresAt?: number | null;
}): Promise<ConnectedGmailAccount | null> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  await syncPublicUserFromAuth(input.userId);

  const { data: existingRow } = await supabase
    .from("connected_gmail_accounts")
    .select("id")
    .eq("user_id", input.userId)
    .eq("email", input.email.toLowerCase())
    .maybeSingle<{ id: string }>();

  const row: Record<string, unknown> = {
    user_id: input.userId,
    email: input.email.toLowerCase(),
    label: input.label?.trim() || defaultAccountLabel(input.email),
    updated_at: new Date().toISOString(),
  };

  if (input.isPrimary != null) row.is_primary = input.isPrimary;
  if (input.refreshToken) row.google_refresh_token = encryptSecret(input.refreshToken);
  if (input.accessToken) row.google_access_token = encryptSecret(input.accessToken);
  if (input.expiresAt) {
    row.google_token_expires_at = new Date(input.expiresAt).toISOString();
  }

  if (existingRow?.id) {
    const { data, error } = await supabase
      .from("connected_gmail_accounts")
      .update(row)
      .eq("id", existingRow.id)
      .select("id, user_id, email, label, is_primary, connected_at")
      .single<AccountRow>();
    if (error || !data) return null;
    return rowToAccount(data);
  }

  if (input.isPrimary) {
    await supabase
      .from("connected_gmail_accounts")
      .update({ is_primary: false })
      .eq("user_id", input.userId);
  }

  const { count: accountCount } = await supabase
    .from("connected_gmail_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId);

  row.is_primary = input.isPrimary ?? (accountCount ?? 0) === 0;

  const { data, error } = await supabase
    .from("connected_gmail_accounts")
    .insert(row)
    .select("id, user_id, email, label, is_primary, connected_at")
    .single<AccountRow>();

  if (error || !data) {
    console.error("[connected-accounts] upsert", error?.message);
    return null;
  }
  return rowToAccount(data);
}

export async function updateConnectedAccountLabel(
  userId: string,
  accountId: string,
  label: string,
): Promise<ConnectedGmailAccount | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("connected_gmail_accounts")
    .update({ label: trimmed, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", accountId)
    .select("id, user_id, email, label, is_primary, connected_at")
    .maybeSingle<AccountRow>();

  if (error || !data) {
    console.error("[connected-accounts] update label", error?.message);
    return null;
  }

  return rowToAccount(data);
}

export async function disconnectGmailAccount(
  userId: string,
  accountId: string,
): Promise<boolean> {
  const account = await getConnectedGmailAccount(userId, accountId);
  if (!account) return false;

  const { error } = await supabase
    .from("connected_gmail_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("id", accountId);

  if (error) {
    console.error("[connected-accounts] disconnect", error.message);
    return false;
  }

  if (account.isPrimary) {
    const remaining = await listConnectedGmailAccounts(userId);
    if (remaining[0]) {
      await supabase
        .from("connected_gmail_accounts")
        .update({ is_primary: true })
        .eq("id", remaining[0].id);
    }
  }

  return true;
}

/** Migrate legacy single-account tokens on public.users into connected_gmail_accounts. */
export async function migrateLegacyTokensToConnectedAccount(
  userId: string,
  fallbackEmail?: string | null,
): Promise<void> {
  const { count, error: countError } = await supabase
    .from("connected_gmail_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    // Table missing or unreachable — skip migration; legacy users-table tokens stay authoritative.
    console.error(
      "[connected-accounts] migration skipped — count query failed:",
      countError.code,
      countError.message,
    );
    return;
  }

  if ((count ?? 0) > 0) return;

  const legacy = await getStoredGoogleTokens(userId);
  if (!legacy?.refreshToken && !legacy?.accessToken) return;

  let email = fallbackEmail?.trim() || "";
  if (!email) {
    const { data } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle<{ email: string | null }>();
    email = data?.email?.trim() ?? "";
  }
  if (!email) {
    // Without a real mailbox address we can't key the account row safely;
    // defer migration until a caller provides the email (e.g. messages route).
    console.warn("[connected-accounts] migration deferred — no email for user", userId);
    return;
  }

  await upsertConnectedGmailAccount({
    userId,
    email,
    isPrimary: true,
    refreshToken: legacy.refreshToken,
    accessToken: legacy.accessToken,
    expiresAt: legacy.expiresAt,
  });
}

/** Keep users-table tokens in sync when primary account is updated (backward compat). */
export async function syncPrimaryTokensToUsersTable(userId: string): Promise<void> {
  const primary = await getPrimaryGmailAccount(userId);
  if (!primary) return;
  const tokens = await getAccountStoredTokens(userId, primary.id);
  if (!tokens) return;
  await saveGoogleTokens(userId, {
    refreshToken: tokens.refreshToken,
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  });
}
