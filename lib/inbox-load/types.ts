export type InboxLoadFailureReason =
  | "network_error"
  | "timeout"
  | "auth_error"
  | "missing_account"
  | "gmail_fetch_failed"
  | "gmail_rate_limit"
  | "db_error"
  | "server_unavailable"
  | "categorization_failure"
  | "headers_too_large"
  | "unknown";

export type InboxLoadStage =
  | "client_session"
  | "client_fetch"
  | "auth"
  | "google_token"
  | "gmail_list"
  | "gmail_metadata"
  | "supabase_context"
  | "categorization"
  | "enrichment";

export type InboxLoadTimings = {
  totalMs?: number;
  clientSessionMs?: number;
  clientFetchMs?: number;
  authMs?: number;
  googleTokenMs?: number;
  gmailListMs?: number;
  gmailMetadataMs?: number;
  supabaseMs?: number;
  categorizeMs?: number;
  enrichmentMs?: number;
};

export type InboxLoadDiagnostics = {
  loadId: string;
  startedAt: number;
  paginated: boolean;
  pageToken?: string | null;
  append?: boolean;
  refresh?: boolean;
  emailCount?: number;
  failureReason?: InboxLoadFailureReason;
  failureStage?: InboxLoadStage;
  gmailStatus?: number | null;
  gmailReason?: string | null;
  retryAfterMs?: number | null;
  backoffDelayMs?: number;
  consecutive429Count?: number;
  timings: InboxLoadTimings;
  slow?: boolean;
};

export type InboxLoadApiErrorBody = {
  error?: string;
  failureReason?: InboxLoadFailureReason;
  failureStage?: InboxLoadStage;
  message?: string;
  reason?: string;
  accountId?: string | null;
  gmailStatus?: number | null;
  gmailReason?: string | null;
  retryAfterMs?: number | null;
  backoffDelayMs?: number;
  consecutive429Count?: number;
  diagnostics?: InboxLoadDiagnostics;
};

export const INBOX_LOAD_SLOW_THRESHOLD_MS = 5000;
export const INBOX_LOAD_CLIENT_TIMEOUT_MS = 90_000;

/** Map legacy / alias error strings to canonical failure reasons. */
export function normalizeInboxFailureReason(
  value: string | undefined | null,
): InboxLoadFailureReason | null {
  if (!value) return null;
  const aliases: Record<string, InboxLoadFailureReason> = {
    network_failure: "network_error",
    auth_failure: "auth_error",
    oauth_expired: "auth_error",
    oauth_missing: "missing_account",
    gmail_api_failure: "gmail_fetch_failed",
    supabase_failure: "db_error",
    invalid_account: "missing_account",
    missing_google_token: "missing_account",
    account_token_unavailable: "auth_error",
    headers_too_large: "headers_too_large",
  };
  if (value in aliases) return aliases[value];
  const known: InboxLoadFailureReason[] = [
    "network_error",
    "timeout",
    "auth_error",
    "missing_account",
    "gmail_fetch_failed",
    "gmail_rate_limit",
    "db_error",
    "server_unavailable",
    "categorization_failure",
    "headers_too_large",
  ];
  return known.includes(value as InboxLoadFailureReason)
    ? (value as InboxLoadFailureReason)
    : null;
}
