"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureApiSessionCookies } from "@/lib/auth/ensure-api-session";
import { inboxLoadFetchHeaders } from "@/lib/inbox-fetch-headers";
import { handledErrorFromInboxFailure } from "@/lib/handled-errors";
import { safeFetchJson } from "@/lib/safe-json-response";
import { emailDetailHasDisplayContent } from "@/lib/email-detail-from-gmail";
import type { EmailDetailPayload } from "@/app/emails/[id]/email-detail-view";

type GmailDetailApiBody = {
  found?: boolean;
  email?: EmailDetailPayload;
  error?: string;
  reason?: string;
  authRequired?: boolean;
};

export type GmailEmailDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; email: EmailDetailPayload };

export function useGmailEmailDetail(
  emailId: string,
  accountId?: string,
  enabled = true,
): {
  state: GmailEmailDetailState;
  reload: () => void;
} {
  const [state, setState] = useState<GmailEmailDetailState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!enabled || !emailId) return;
    setState({ status: "loading" });
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    const qs = params.toString();
    const endpoint = `/api/gmail/messages/${encodeURIComponent(emailId)}${qs ? `?${qs}` : ""}`;

    try {
      const hasCookies = await ensureApiSessionCookies();
      if (!hasCookies) {
        setState({ status: "error", message: "Sign in required" });
        return;
      }

      const result = await safeFetchJson<GmailDetailApiBody>(endpoint, {
        label: "[inbox-zero] gmail message",
        credentials: "include",
        headers: await inboxLoadFetchHeaders(),
      });

      if (!result.ok) {
        console.error("[inbox-zero] email detail fetch failed", {
          endpoint,
          accountId,
          status: result.status,
          error: result.error,
        });
        const message =
          result.status === 431
            ? handledErrorFromInboxFailure("headers_too_large").userMessage
            : (result.error ?? "Could not load email");
        setState({
          status: "error",
          message,
        });
        return;
      }

      const body = result.data;
      if (!body.email) {
        const retryReason = body.reason ?? body.error ?? "missing_email_payload";
        console.error("[inbox-zero] email detail empty — retry reason:", retryReason, {
          endpoint,
          accountId,
        });
        setState({
          status: "error",
          message: body.error === "email_content_empty"
            ? "email_content_empty"
            : body.error ?? "Could not load email",
        });
        return;
      }

      if (!emailDetailHasDisplayContent(body.email)) {
        console.error("[inbox-zero] email detail missing display content", {
          endpoint,
          accountId,
          emailId,
        });
        setState({ status: "error", message: "email_content_empty" });
        return;
      }

      setState({ status: "ready", email: body.email });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not load email",
      });
    }
  }, [emailId, accountId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
