"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalmFadeIn } from "@/app/components/calm-loading";
import { EmailDetailSkeleton } from "@/app/components/email-detail-skeleton";
import { EmailDetailView, type EmailDetailPayload } from "./email-detail-view";
import { EmailDetailAuthVisible } from "./email-detail-auth-visible";
import { EmailDetailNotFound } from "./email-detail-not-found";
import { EmailDetailVisibleError } from "./email-detail-visible-error";
import { useUiCopy } from "@/app/use-ui-copy";
import { ensureApiSessionCookies } from "@/lib/auth/ensure-api-session";
import { emailDetailHasDisplayContent } from "@/lib/email-detail-from-gmail";
import { readEmailPreview, type EmailPreviewCache } from "@/lib/email-preview-cache";
import { inboxLoadFetchHeaders } from "@/lib/inbox-fetch-headers";
import { handledErrorFromInboxFailure } from "@/lib/handled-errors";
import { safeFetchJson } from "@/lib/safe-json-response";
import { loadReadStateMap } from "@/lib/read-state/client-storage";
import { markEmailsRead } from "@/lib/read-state/gmail-sync";

type GmailDetailApiBody = {
  found?: boolean;
  email?: EmailDetailPayload;
  error?: string;
  reason?: string;
  failureReason?: string;
  authRequired?: boolean;
  enrichmentDegraded?: boolean;
};

type LoadState =
  | { status: "loading" }
  | { status: "auth"; reason: "sign_in" | "connect_gmail" | "server_session" }
  | { status: "not_found" }
  | { status: "error"; message: string; raw?: unknown }
  | { status: "ready"; email: EmailDetailPayload };

type EmailDetailClientLoaderProps = {
  emailId: string;
};

export function EmailDetailClientLoader({ emailId }: EmailDetailClientLoaderProps) {
  const ui = useUiCopy();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [preview] = useState<EmailPreviewCache | null>(() =>
    typeof window !== "undefined" ? readEmailPreview(emailId) : null,
  );

  const loadEmail = useCallback(async () => {
    setState({ status: "loading" });
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    const qs = params.toString();
    const endpoint = `/api/gmail/messages/${encodeURIComponent(emailId)}${qs ? `?${qs}` : ""}`;

    try {
      const hasCookies = await ensureApiSessionCookies();
      if (!hasCookies) {
        setState({ status: "auth", reason: "sign_in" });
        return;
      }

      const result = await safeFetchJson<GmailDetailApiBody>(endpoint, {
        label: "[email-detail] gmail message",
        credentials: "include",
        headers: await inboxLoadFetchHeaders(),
      });

      if (!result.ok) {
        console.error("[email-detail] fetch failed", {
          endpoint,
          status: result.status,
          contentType: result.contentType,
          isHtml: result.isHtml,
          error: result.error,
          preview: result.preview,
        });
        if (result.status === 431) {
          setState({
            status: "error",
            message: handledErrorFromInboxFailure("headers_too_large").userMessage,
          });
          return;
        }
        if (result.status === 401 || result.status === 403) {
          setState({ status: "auth", reason: "server_session" });
          return;
        }
        if (result.isHtml || result.redirectedTo?.includes("/login")) {
          setState({
            status: "error",
            message:
              result.status >= 500
                ? "Email API crashed on the server (500). Deploy fix or check Vercel logs."
                : "Server returned HTML instead of JSON.",
            raw: { endpoint, status: result.status, preview: result.preview },
          });
          return;
        }
        setState({
          status: "error",
          message: result.error,
          raw: { endpoint, preview: result.preview },
        });
        return;
      }

      const body = result.data;
      const res = result.response;

      if (res.status === 401 || body.error === "auth_error" || body.failureReason === "auth_error") {
        setState({ status: "auth", reason: "server_session" });
        return;
      }

      if (
        res.status === 403 &&
        (body.error === "missing_account" ||
          body.failureReason === "missing_account" ||
          body.error === "missing_google_token")
      ) {
        setState({ status: "auth", reason: "connect_gmail" });
        return;
      }

      if (res.status === 404 || body.found === false) {
        setState({ status: "not_found" });
        return;
      }

      if (!res.ok || !body.email) {
        const retryReason = body.reason ?? body.error ?? `Request failed (${res.status})`;
        console.error("[email-detail] API error payload — retry reason:", retryReason, {
          endpoint,
          status: res.status,
          accountId,
          body,
        });
        setState({
          status: "error",
          message: body.error === "email_content_empty"
            ? "email_content_empty"
            : body.error || `Request failed (${res.status})`,
          raw: { ...body, retryReason },
        });
        return;
      }

      if (!emailDetailHasDisplayContent(body.email)) {
        console.error("[email-detail] loaded email missing display content — retry reason: empty_body_after_load", {
          endpoint,
          accountId,
          emailId,
        });
        setState({
          status: "error",
          message: "email_content_empty",
          raw: { retryReason: "empty_body_after_load", emailId, accountId },
        });
        return;
      }

      setState({ status: "ready", email: body.email });
    } catch (error) {
      console.error("[email-detail] load failed — retry reason:", error);
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        raw: { retryReason: error },
      });
    }
  }, [emailId, accountId]);

  useEffect(() => {
    void loadEmail();
  }, [loadEmail]);

  // Opening an email marks it read locally + removes Gmail's UNREAD label
  // (synced to the account that owns the message).
  useEffect(() => {
    if (state.status !== "ready") return;
    if (loadReadStateMap()[emailId] === "read") return;
    markEmailsRead([emailId], { accountId: accountId ?? undefined });
  }, [state.status, emailId, accountId]);

  const skeletonPreview = useMemo(() => preview, [preview]);

  if (state.status === "loading") {
    return (
      <EmailDetailSkeleton
        preview={skeletonPreview}
        backLabel={ui.common.backToInbox}
        openingLabel={ui.calm.loading.openingEmail}
      />
    );
  }

  if (state.status === "auth") {
    return <EmailDetailAuthVisible emailId={emailId} reason={state.reason} />;
  }

  if (state.status === "not_found") {
    return <EmailDetailNotFound emailId={emailId} />;
  }

  if (state.status === "error") {
    return (
      <EmailDetailVisibleError
        error={state.raw ?? state.message}
        onRetry={() => void loadEmail()}
      />
    );
  }

  return (
    <CalmFadeIn>
      <EmailDetailView email={state.email} showActions enrichmentEnabled />
    </CalmFadeIn>
  );
}
