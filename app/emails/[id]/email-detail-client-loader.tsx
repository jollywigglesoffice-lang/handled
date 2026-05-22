"use client";

import { useCallback, useEffect, useState } from "react";
import { EmailDetailView, type EmailDetailPayload } from "./email-detail-view";
import { EmailDetailAuthVisible } from "./email-detail-auth-visible";
import { EmailDetailNotFound } from "./email-detail-not-found";
import { EmailDetailVisibleError } from "./email-detail-visible-error";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";
import { safeFetchJson } from "@/lib/safe-json-response";

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
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadEmail = useCallback(async () => {
    setState({ status: "loading" });
    const endpoint = `/api/gmail/messages/${encodeURIComponent(emailId)}`;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabaseBrowser.auth.getSession();

      if (sessionError) {
        console.error("[email-detail] getSession error", sessionError);
      }

      if (!session?.user?.id) {
        setState({ status: "auth", reason: "sign_in" });
        return;
      }

      const result = await safeFetchJson<GmailDetailApiBody>(endpoint, {
        label: "[email-detail] gmail message",
        headers: inboxFetchHeaders(),
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
        if (result.isHtml || result.redirectedTo?.includes("/login")) {
          setState({ status: "auth", reason: "server_session" });
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

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-4 py-16">
        <p className="text-sm text-gray-500">Loading email…</p>
      </main>
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
        label="EMAIL DETAIL ERROR (client load):"
        error={state.raw ?? state.message}
      />
    );
  }

  return <EmailDetailView email={state.email} showActions enrichmentEnabled />;
}
