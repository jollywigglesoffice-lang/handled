"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthResolution } from "@/app/auth-resolution-context";
import { useEmailCompletions } from "@/app/email-completions-context";
import { GuidedOnboardingFlow } from "@/app/onboarding/guided-onboarding-flow";
import { useOnboardingRouteGuard } from "@/app/hooks/use-onboarding-route-guard";
import { useUserPreferences } from "@/app/user-preferences-context";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { inboxLoadFetchHeaders } from "@/lib/inbox-fetch-headers";
import { INBOX_LOAD_CLIENT_TIMEOUT_MS } from "@/lib/inbox-load/types";
import { scopedEmailKey } from "@/lib/gmail/account-types";
import {
  FIRST_ONBOARDING_COMPLETE_EVENT,
  markFirstOnboardingComplete,
} from "@/lib/onboarding/first-time";
import {
  ONBOARDING_RESET_EVENT,
  registerOnboardingResetDevHelper,
  tryApplyOnboardingReset,
} from "@/lib/onboarding/reset";
import { trackEvent } from "@/lib/analytics";

type InboxMode = "loading" | "no_google" | "gmail" | "gmail_empty" | "gmail_error";

export function OnboardingClient() {
  const router = useRouter();
  const { isAuthenticated, authStatus } = useAuthResolution();
  const { isCompleted } = useEmailCompletions();
  const { uiLanguage } = useUserPreferences();
  const locale = uiLanguage === "it" ? "it" : "en";

  useOnboardingRouteGuard();

  const [inboxMode, setInboxMode] = useState<InboxMode>("loading");
  const [messages, setMessages] = useState<GmailCardMessage[]>([]);
  const [connectedAccountCount, setConnectedAccountCount] = useState(0);

  useEffect(() => {
    registerOnboardingResetDevHelper();
    tryApplyOnboardingReset();
  }, []);

  const loadOnboardingMessages = useCallback(async () => {
    if (!isAuthenticated) return;

    setInboxMode("loading");
    try {
      const res = await fetch("/api/gmail/messages?onboarding=1", {
        credentials: "include",
        headers: await inboxLoadFetchHeaders(),
        signal: AbortSignal.timeout(INBOX_LOAD_CLIENT_TIMEOUT_MS),
      });

      if (res.status === 403) {
        setInboxMode("no_google");
        setConnectedAccountCount(0);
        return;
      }

      if (!res.ok) {
        setInboxMode("gmail_error");
        return;
      }

      const body = (await res.json()) as {
        messages?: GmailCardMessage[];
        accounts?: Array<{ id: string }>;
        error?: string;
      };

      setConnectedAccountCount(body.accounts?.length ?? 0);
      const loaded = (body.messages ?? []) as GmailCardMessage[];
      setMessages(loaded);
      setInboxMode(loaded.length > 0 ? "gmail" : "gmail_empty");
    } catch {
      setInboxMode("gmail_error");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const onReset = () => {
      setMessages([]);
      setInboxMode("loading");
      void loadOnboardingMessages();
    };
    window.addEventListener(ONBOARDING_RESET_EVENT, onReset);
    return () => window.removeEventListener(ONBOARDING_RESET_EVENT, onReset);
  }, [loadOnboardingMessages]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void loadOnboardingMessages();
  }, [authStatus, loadOnboardingMessages]);

  const fetchMoreExamples = useCallback(async () => {
    const res = await fetch("/api/gmail/messages?onboarding=1", {
      credentials: "include",
      headers: await inboxLoadFetchHeaders(),
      signal: AbortSignal.timeout(INBOX_LOAD_CLIENT_TIMEOUT_MS),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { messages?: GmailCardMessage[] };
    if (!body.messages?.length) return;

    setMessages((prev) => {
      const merged = new Map(
        prev.map((m) => [scopedEmailKey(m.id, m.accountId), m] as const),
      );
      for (const message of body.messages ?? []) {
        merged.set(
          scopedEmailKey(message.id, message.accountId),
          message as GmailCardMessage,
        );
      }
      return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date));
    });
    if (inboxMode === "gmail_empty") {
      setInboxMode("gmail");
    }
  }, [inboxMode]);

  const displayMessages = useMemo(() => messages, [messages]);

  const handleFinished = useCallback(() => {
    markFirstOnboardingComplete();
    trackEvent("guided_onboarding_completed");
    window.dispatchEvent(new Event(FIRST_ONBOARDING_COMPLETE_EVENT));
    router.replace("/emails");
  }, [router]);

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <GuidedOnboardingFlow
          locale={locale}
          inboxMode={inboxMode}
          signedIn={isAuthenticated}
          connectedAccountCount={connectedAccountCount}
          messages={displayMessages}
          isCompleted={isCompleted}
          onFinished={handleFinished}
          onFetchMoreExamples={fetchMoreExamples}
        />
      </div>
    </main>
  );
}
