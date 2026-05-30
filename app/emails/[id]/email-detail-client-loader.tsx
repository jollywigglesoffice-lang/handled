"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalmFadeIn } from "@/app/components/calm-loading";
import { EmailDetailSkeleton } from "@/app/components/email-detail-skeleton";
import { EmailDetailView, type EmailDetailPayload } from "./email-detail-view";
import { EmailDetailAuthVisible } from "./email-detail-auth-visible";
import { EmailDetailNotFound } from "./email-detail-not-found";
import { EmailDetailVisibleError } from "./email-detail-visible-error";
import { useUiCopy } from "@/app/use-ui-copy";
import { ensureApiSessionCookies } from "@/lib/auth/ensure-api-session";
import { readEmailPreview, type EmailPreviewCache } from "@/lib/email-preview-cache";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";
import { safeFetchJson } from "@/lib/safe-json-response";
import { loadReadStateMap } from "@/lib/read-state/client-storage";
import { markEmailsRead } from "@/lib/read-state/gmail-sync";

type GmailDetailApiBody = {
  found?: boolean;
  email?: EmailDetailPayload;
  error?: string;
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
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [preview] = useState<EmailPreviewCache | null>(() =>
    typeof window !== "undefined" ? readEmailPreview(emailId) : null,
  );

  const loadEmail = useCallback(async () => {
    setState({ status: "loading" });
    const endpoint = `/api/gmail/messages/${encodeURIComponent(emailId)}`;

    try {
      const hasCookies = await ensureApiSessionCookies();
      if (!hasCookies) {
        setState({ status: "auth", reason: "sign_in" });
        return;
      }

      const result = await safeFetchJson<GmailDetailApiBody>(endpoint, {
        label: "[email-detail] gmail message",
        credentials: "include",
        headers: await inboxFetchHeaders(),
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

      if (res.status === 401 || body.authRequired) {
        setState({ status: "auth", reason: "server_session" });
        return;
      }

      if (res.status === 403 && body.error === "missing_google_token") {
        setState({ status: "auth", reason: "connect_gmail" });
        return;
      }

      if (res.status === 404 || body.found === false) {
        setState({ status: "not_found" });
        return;
      }

      if (!res.ok || !body.email) {
        console.error("[email-detail] API error payload", {
          endpoint,
          status: res.status,
          body,
        });
        setState({
          status: "error",
          message: body.error || `Request failed (${res.status})`,
          raw: body,
        });
        return;
      }

      setState({ status: "ready", email: body.email });
    } catch (error) {
      console.error("EMAIL DETAIL LOAD ERROR:", error);
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        raw: error,
      });
    }
  }, [emailId]);

  useEffect(() => {
    void loadEmail();
  }, [loadEmail]);

  // Opening an email marks it read locally + removes Gmail's UNREAD label.
  useEffect(() => {
    if (state.status !== "ready") return;
    if (loadReadStateMap()[emailId] === "read") return;
    markEmailsRead([emailId]);
  }, [state.status, emailId]);

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
