"use client";

import { useCallback, useEffect, useState } from "react";
import { EmailDetailView, type EmailDetailPayload } from "./email-detail-view";
import { EmailDetailAuthVisible } from "./email-detail-auth-visible";
import { EmailDetailNotFound } from "./email-detail-not-found";
import { EmailDetailVisibleError, formatDetailError } from "./email-detail-visible-error";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";

type LoadState =
  | { status: "loading" }
  | { status: "auth"; reason: "sign_in" | "connect_gmail" | "server_session" }
  | { status: "not_found" }
  | { status: "error"; message: string; raw?: unknown }
  | { status: "ready"; email: EmailDetailPayload };

type EmailDetailClientLoaderProps = {
  emailId: string;
};

/** Same fetch pattern as inbox: getSession + /api/gmail/messages/[id] + inboxFetchHeaders(). */
export function EmailDetailClientLoader({ emailId }: EmailDetailClientLoaderProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadEmail = useCallback(async () => {
    setState({ status: "loading" });

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

      const res = await fetch(`/api/gmail/messages/${encodeURIComponent(emailId)}`, {
        credentials: "same-origin",
        headers: inboxFetchHeaders(),
      });

      const body = (await res.json()) as {
        found?: boolean;
        email?: EmailDetailPayload;
        error?: string;
        authRequired?: boolean;
        enrichmentDegraded?: boolean;
      };

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
        console.error("EMAIL DETAIL LOAD ERROR:", { status: res.status, body });
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
        message: formatDetailError(error),
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
