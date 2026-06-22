import { parseRetryAfterMs } from "@/lib/inbox-load/rate-limit-backoff";

export class GmailApiError extends Error {
  readonly status: number;
  readonly body: string;
  readonly retryAfterMs: number | null;
  readonly gmailReason: string | null;

  constructor(
    operation: string,
    status: number,
    body: string,
    options?: { retryAfterHeader?: string | null },
  ) {
    super(`${operation} failed: ${status} ${body}`);
    this.name = "GmailApiError";
    this.status = status;
    this.body = body;
    this.retryAfterMs = parseRetryAfterMs(status, body, options?.retryAfterHeader ?? null);

    try {
      const parsed = JSON.parse(body) as {
        error?: { errors?: Array<{ reason?: string }> };
      };
      this.gmailReason = parsed.error?.errors?.[0]?.reason ?? null;
    } catch {
      this.gmailReason = null;
    }
  }

  get isRateLimit(): boolean {
    return (
      this.status === 429 ||
      /ratelimitexceeded|userratelimitexceeded|quotaexceeded/i.test(
        `${this.body} ${this.gmailReason ?? ""}`,
      )
    );
  }
}
