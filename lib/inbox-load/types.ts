export type InboxLoadFailureReason =
  | "network_failure"
  | "timeout"
  | "oauth_expired"
  | "oauth_missing"
  | "gmail_api_failure"
  | "gmail_rate_limit"
  | "supabase_failure"
  | "auth_failure"
  | "server_unavailable"
  | "categorization_failure"
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
  gmailStatus?: number | null;
  gmailReason?: string | null;
  retryAfterMs?: number | null;
  backoffDelayMs?: number;
  consecutive429Count?: number;
  diagnostics?: InboxLoadDiagnostics;
};

export const INBOX_LOAD_SLOW_THRESHOLD_MS = 5000;
export const INBOX_LOAD_CLIENT_TIMEOUT_MS = 90_000;
