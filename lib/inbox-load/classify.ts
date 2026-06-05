import type { InboxLoadApiErrorBody, InboxLoadFailureReason } from "@/lib/inbox-load/types";

type GmailErrorParse = {
  reason: InboxLoadFailureReason;
  gmailStatus?: number;
  gmailReason?: string;
};

function tryParseGmailJson(body: string): {
  error?: { code?: number; message?: string; status?: string; errors?: Array<{ reason?: string }> };
} | null {
  try {
    return JSON.parse(body) as {
      error?: { code?: number; message?: string; status?: string; errors?: Array<{ reason?: string }> };
    };
  } catch {
    return null;
  }
}

/** Classify a Gmail HTTP response body + status. */
export function classifyGmailHttpError(status: number, body: string): GmailErrorParse {
  const parsed = tryParseGmailJson(body);
  const gmailReason = parsed?.error?.errors?.[0]?.reason ?? parsed?.error?.status ?? undefined;
  const hay = `${body} ${gmailReason ?? ""}`.toLowerCase();

  if (status === 401 || hay.includes("unauthenticated") || hay.includes("invalid credentials")) {
    return { reason: "oauth_expired", gmailStatus: status, gmailReason };
  }

  if (
    status === 429 ||
    hay.includes("ratelimitexceeded") ||
    hay.includes("userratelimitexceeded") ||
    hay.includes("quotaexceeded") ||
    hay.includes("rate limit")
  ) {
    return { reason: "gmail_rate_limit", gmailStatus: status, gmailReason };
  }

  if (status >= 500) {
    return { reason: "server_unavailable", gmailStatus: status, gmailReason };
  }

  return { reason: "gmail_api_failure", gmailStatus: status, gmailReason };
}

/** Classify an Error thrown by gmail-api helpers (`Gmail list failed: 429 {...}`). */
export function classifyGmailThrownError(error: unknown): GmailErrorParse {
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/failed:\s*(\d{3})\b/i);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;
  const body = message.replace(/^[^:]+:\s*\d{3}\s*/, "");
  if (status) return classifyGmailHttpError(status, body || message);
  if (/unauthenticated|invalid credentials/i.test(message)) {
    return { reason: "oauth_expired" };
  }
  if (/rate.?limit|quota/i.test(message)) {
    return { reason: "gmail_rate_limit" };
  }
  return { reason: "gmail_api_failure" };
}

export function classifySupabaseError(error: unknown): InboxLoadFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  const hay = message.toLowerCase();
  if (/supabase|postgres|pgrst|schema cache|column.*does not exist/i.test(hay)) {
    return "supabase_failure";
  }
  return "unknown";
}

export function classifyFetchError(error: unknown): InboxLoadFailureReason {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /timeout|timed out/i.test(error.message)) {
      return "timeout";
    }
    if (
      /failed to fetch|network error|load failed|enotfound|econnrefused|networkrequestfailed|err_internet_disconnected/i.test(
        error.message,
      )
    ) {
      return "network_failure";
    }
  }
  return "network_failure";
}

export function classifyHttpStatus(status: number, body: InboxLoadApiErrorBody): InboxLoadFailureReason {
  if (body.failureReason) return body.failureReason;
  if (status === 401) return "auth_failure";
  if (status === 403 && body.error === "missing_google_token") return "oauth_missing";
  if (status === 403) return "oauth_expired";
  if (status === 429) return "gmail_rate_limit";
  if (status >= 500) return "server_unavailable";
  if (status === 408) return "timeout";
  const hay = `${body.error ?? ""} ${body.message ?? ""}`.toLowerCase();
  if (/gmail|googleapis/.test(hay)) return "gmail_api_failure";
  if (/supabase|postgres/.test(hay)) return "supabase_failure";
  return "unknown";
}
