"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fakeEmails,
  getInboxSections,
  type FakeEmail,
  type InboxSectionTitle,
} from "@/lib/fake-emails";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useHandledEmails } from "@/app/handled-emails-context";
import { AuthNav } from "@/app/components/auth-nav";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import { applyCategoryOverrides } from "@/lib/inbox-buckets";
import { loadClientEmailOverrideMap } from "@/lib/email-overrides/client-storage";
import {
  removeEmailOverrideFromAccount,
  syncEmailOverridesFromAccount,
} from "@/lib/email-overrides/client-sync";
import { syncSenderRelationshipsFromAccount } from "@/lib/relationship-intelligence/client-sync";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import { fakeEmailsToInboxMessages } from "@/lib/inbox-buckets-mock";
import { syncWorkflowModeFromAccount } from "@/lib/workflow-mode/client-sync";
import { FollowUpsSection } from "@/app/emails/follow-ups-section";
import { DailyWorkspacePanel } from "@/app/emails/daily-workspace-panel";
import { ContextualSearchPanel } from "@/app/emails/contextual-search-panel";
import { DailyBriefingPanel } from "@/app/emails/daily-briefing-panel";
import { ProactiveSuggestionsPanel } from "@/app/emails/proactive-suggestions-panel";
import { WorkflowModeBanner } from "@/app/emails/workflow-mode-banner";
import { InboxClutterSection } from "@/app/emails/inbox-clutter-section";
import { useStableInboxBuckets } from "@/app/emails/use-stable-inbox-buckets";
import { GmailInboxCard, type GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { InboxTrainingBanner } from "@/app/emails/inbox-training-banner";
import { InboxSyncBar } from "@/app/emails/inbox-sync-bar";
import {
  type CategorySource,
  type InboxAiCategory,
  inboxCategorySectionSubtitle,
  inboxCategorySectionTitle,
  normalizeInboxAiCategory,
} from "@/lib/inbox-ai-categories";
import { applySenderRuleToMessages } from "@/lib/sender-rules/apply-to-messages";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";

type GmailInboxMessage = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  internalDateMs?: number;
  category: InboxAiCategory;
  categoryConfidence?: number;
  categorySource?: CategorySource;
  hasUnsubscribeSignal?: boolean;
  needsCalendarContext?: boolean;
  actionIntelligence?: import("@/lib/action-intelligence").ActionIntelligenceSummary;
  timelineIntelligence?: import("@/lib/timeline-intelligence").TimelineIntelligenceSummary;
  relationship?: SenderRelationshipProfile;
};

type InboxMode =
  | "loading"
  | "gmail"
  | "gmail_empty"
  | "mock"
  | "no_google"
  | "gmail_error";

function SectionIcon({ title }: { title: InboxSectionTitle }) {
  if (title === "Needs Your Attention") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4 text-[#6366F1]"
        fill="none"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6.25v4.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="13.6" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  if (title === "Handled For You") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4 text-[#6366F1]"
        fill="none"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6.8 10.2l2.2 2.2 4.3-4.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 text-[#6366F1]"
      fill="none"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 10h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getSectionLabel(title: InboxSectionTitle, ui: ReturnType<typeof useUiCopy>) {
  if (title === "Needs Your Attention") {
    return ui.sections.needsYourAttention;
  }
  if (title === "Handled For You") {
    return ui.sections.handledForYou;
  }
  return ui.sections.hiddenInbox;
}

function formatInboxDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function GmailSectionLeadingIcon({ category }: { category: InboxAiCategory }) {
  const common = "h-5 w-5 shrink-0 text-[#6366F1]";
  if (category === "needs_attention") {
    return (
      <svg aria-hidden className={common} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.25v4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="13.6" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  if (category === "quick_reply") {
    return (
      <svg aria-hidden className={common} viewBox="0 0 20 20" fill="none">
        <path
          d="M4.5 12.5V16l3.2-2.1a7 7 0 1 1-1.7-1.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (category === "handled") {
    return (
      <svg aria-hidden className={common} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6.8 10.2l2.2 2.2 4.3-4.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (category === "newsletter") {
    return (
      <svg aria-hidden className={common} viewBox="0 0 20 20" fill="none">
        <path
          d="M5.5 6.5h9v8h-9v-8z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M5.5 8.5h9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden className={common} viewBox="0 0 20 20" fill="none">
      <path
        d="M6.5 7.5h7l-1 8h-5l-1-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 5.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GmailCategorySectionHeader({
  category,
  locale,
  count,
}: {
  category: InboxAiCategory;
  locale: "en" | "it";
  count: number;
}) {
  const subtitle = inboxCategorySectionSubtitle(category, locale);
  return (
    <div className="border-b border-[#E2E8F0] pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <GmailSectionLeadingIcon category={category} />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-[#0F172A]">
              {inboxCategorySectionTitle(category, locale)}
            </h2>
            {subtitle ? (
              <p className="text-sm leading-relaxed text-gray-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium tabular-nums text-gray-600">
          {count}
        </span>
      </div>
    </div>
  );
}

function MockEmailCard({
  id,
  sender,
  subject,
  summary,
  category,
  highlighted = false,
}: FakeEmail & { highlighted?: boolean }) {
  return (
    <Link
      href={`/emails/${id}`}
      className={`block rounded-xl border p-6 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${
        highlighted
          ? "border-[#C7D2FE] bg-[#EEF2FF]/40 hover:border-[#A5B4FC]"
          : "border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#6366F1]/40"
      }`}
    >
      <article className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-500">{sender}</p>
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-gray-500">
            {category}
          </span>
        </div>
        <h3 className="text-base font-medium text-[#0F172A]">{subject}</h3>
        <p className="text-sm leading-relaxed text-gray-500">{summary}</p>
      </article>
    </Link>
  );
}


function EmailCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm">
      <div className="space-y-3 animate-pulse">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-40 rounded-lg bg-gray-200" />
          <div className="h-4 w-20 rounded-lg bg-gray-200" />
        </div>
        <div className="h-6 w-3/4 rounded-lg bg-gray-200" />
        <div className="h-4 w-full rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

function HandledTodayItem({ id, sender, subject }: Pick<FakeEmail, "id" | "sender" | "subject">) {
  return (
    <Link
      href={`/emails/${id}`}
      className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-left transition-all duration-200 hover:bg-[#F1F5F9]"
    >
      <span
        aria-hidden="true"
        className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[#94A3B8]"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#64748B]">{sender}</p>
        <p className="truncate text-sm text-gray-500">{subject}</p>
      </div>
    </Link>
  );
}

function EmptyNeedsAttentionState({ show }: { show: boolean }) {
  const ui = useUiCopy();

  return (
    <div
      className={`flex min-h-52 flex-col items-center justify-center space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center transition-all duration-700 ${
        show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#CBD5E1] bg-[#FFFFFF] shadow-sm"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#64748B]" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M6.9 10.2l2.1 2.1 4.2-4.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="text-xl font-medium text-[#0F172A]">{ui.home.allCaughtUp}</p>
      <p className="text-sm text-gray-500">{ui.home.everythingHandledEmpty}</p>
      <p className="pt-1 text-xs text-gray-400">{ui.home.comeBackLater}</p>
    </div>
  );
}

export default function EmailsInboxPage() {
  const ui = useUiCopy();
  const { uiLanguage, setUiLanguage } = useUserPreferences();
  const loadingMicroMessages = ui.home.loadingMicroMessages;
  const { handledEmailIds } = useHandledEmails();

  const inboxSections = getInboxSections().map((section) => ({
    ...section,
    emails:
      section.title === "Needs Your Attention" || section.title === "Handled For You"
        ? section.emails.filter((email) => !handledEmailIds.includes(email.id))
        : section.emails,
  }));
  const handledTodayEmails = fakeEmails.filter((email) =>
    handledEmailIds.includes(email.id),
  );

  const [inboxMode, setInboxMode] = useState<InboxMode>("loading");
  const [gmailMessages, setGmailMessages] = useState<GmailInboxMessage[]>([]);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, InboxAiCategory>>(
    () => loadClientEmailOverrideMap(),
  );
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [workflowMode, setWorkflowMode] = useState(readWorkflowModeFromStorage);
  const [gmailError, setGmailError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showMicroMessage, setShowMicroMessage] = useState(true);

  const loadInbox = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setInboxMode("loading");
    }
    setIsRefreshing(true);
    setGmailError("");

    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    try {
      if (!session) {
        setInboxMode("mock");
        return;
      }

      const res = await fetch("/api/gmail/messages", {
        credentials: "same-origin",
        headers: inboxFetchHeaders(),
      });
      const body = (await res.json()) as {
        messages?: GmailInboxMessage[];
        error?: string;
        message?: string;
      };

      if (res.status === 403 && body.error === "missing_google_token") {
        setInboxMode("no_google");
        return;
      }

      if (!res.ok) {
        setGmailError(
          typeof body.message === "string"
            ? body.message
            : body.error || "Could not load Gmail inbox.",
        );
        setInboxMode("gmail_error");
        return;
      }

      const msgsRaw = body.messages ?? [];
      const msgs: GmailInboxMessage[] = msgsRaw.map((row) => {
        const r = row as GmailInboxMessage & {
          category?: string;
          categoryConfidence?: number;
          categorySource?: CategorySource;
          hasUnsubscribeSignal?: boolean;
          needsCalendarContext?: boolean;
          actionIntelligence?: GmailCardMessage["actionIntelligence"];
        };
        return {
          id: r.id,
          threadId: (r as { threadId?: string }).threadId,
          sender: r.sender,
          subject: r.subject,
          snippet: r.snippet,
          date: r.date,
          internalDateMs:
            typeof (r as { internalDateMs?: number }).internalDateMs === "number"
              ? (r as { internalDateMs: number }).internalDateMs
              : undefined,
          category: normalizeInboxAiCategory(
            typeof r.category === "string" ? r.category : "needs_attention",
          ),
          categoryConfidence:
            typeof r.categoryConfidence === "number" ? r.categoryConfidence : undefined,
          categorySource:
            r.categorySource === "rule" ||
            r.categorySource === "ai" ||
            r.categorySource === "heuristic" ||
            r.categorySource === "ai_coerced" ||
            r.categorySource === "user_rule" ||
            r.categorySource === "sender_rule" ||
            r.categorySource === "manual_override" ||
            r.categorySource === "relationship_rule" ||
            r.categorySource === "semantic_rule" ||
            r.categorySource === "multilingual_rule"
              ? r.categorySource
              : undefined,
          hasUnsubscribeSignal: Boolean(r.hasUnsubscribeSignal),
          needsCalendarContext: Boolean(r.needsCalendarContext),
          actionIntelligence: (r as { actionIntelligence?: GmailCardMessage["actionIntelligence"] })
            .actionIntelligence,
          timelineIntelligence: (
            r as { timelineIntelligence?: GmailCardMessage["timelineIntelligence"] }
          ).timelineIntelligence,
          relationship:
            (r as { relationship?: SenderRelationshipProfile }).relationship ?? undefined,
        };
      });
      setGmailMessages(msgs);
      setInboxMode(msgs.length ? "gmail" : "gmail_empty");
      setLastSyncedAt(new Date().toISOString());
    } catch (e) {
      console.error("[inbox] gmail load", e);
      setGmailError("Network error while loading Gmail.");
      setInboxMode("gmail_error");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      const [mode, overrides] = await Promise.all([
        syncWorkflowModeFromAccount(),
        session ? syncEmailOverridesFromAccount() : Promise.resolve(loadClientEmailOverrideMap()),
        session ? syncSenderRelationshipsFromAccount() : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setWorkflowMode(mode);
      setCategoryOverrides(overrides);
      setPersistenceReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistenceReady) return;
    void loadInbox();
  }, [loadInbox, persistenceReady]);

  useEffect(() => {
    const onModeChange = () => {
      setWorkflowMode(readWorkflowModeFromStorage());
      void loadInbox();
    };
    const onRulesChange = () => {
      void loadInbox();
    };
    const onOverridesChange = async () => {
      const overrides = await syncEmailOverridesFromAccount();
      setCategoryOverrides(overrides);
      void loadInbox({ silent: true });
    };
    window.addEventListener("handled-workflow-mode-changed", onModeChange);
    window.addEventListener("handled-inbox-rules-changed", onRulesChange);
    window.addEventListener("handled-inbox-refresh-requested", onRulesChange);
    window.addEventListener("handled-sender-preferences-changed", onRulesChange);
    window.addEventListener("handled-email-overrides-changed", onOverridesChange);
    window.addEventListener("handled-sender-relationships-changed", onRulesChange);
    return () => {
      window.removeEventListener("handled-workflow-mode-changed", onModeChange);
      window.removeEventListener("handled-inbox-rules-changed", onRulesChange);
      window.removeEventListener("handled-inbox-refresh-requested", onRulesChange);
      window.removeEventListener("handled-sender-preferences-changed", onRulesChange);
      window.removeEventListener("handled-email-overrides-changed", onOverridesChange);
      window.removeEventListener("handled-sender-relationships-changed", onRulesChange);
    };
  }, [loadInbox]);

  useEffect(() => {
    if (inboxMode !== "gmail") return;
    const intervalId = window.setInterval(() => {
      void loadInbox({ silent: true });
    }, 3 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [inboxMode, loadInbox]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    void (async () => {
      try {
        const res = await fetch("/api/verify-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as { ok?: boolean };
        if (res.ok && data.ok) {
          console.log("[inbox] Pro synced via checkout session verify");
          window.dispatchEvent(new Event("handled-pro-updated"));
        }
      } catch (error) {
        console.error("[inbox] verify-checkout-session failed", error);
      }
    })();
  }, []);

  const inboxLoading = !persistenceReady || inboxMode === "loading";
  const showContent = !inboxLoading;

  useEffect(() => {
    if (!inboxLoading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setShowMicroMessage(false);
      window.setTimeout(() => {
        setMessageIndex((currentIndex) =>
          currentIndex === loadingMicroMessages.length - 1 ? 0 : currentIndex + 1,
        );
        setShowMicroMessage(true);
      }, 300);
    }, 2200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [inboxLoading, loadingMicroMessages.length]);

  const messagesWithOverrides = useMemo(
    () => applyCategoryOverrides(gmailMessages, categoryOverrides),
    [gmailMessages, categoryOverrides],
  );

  const { buckets: gmailBuckets, isCountsPending } = useStableInboxBuckets({
    messages: messagesWithOverrides,
    workflowMode,
    isRefreshing,
    isInitialLoading: inboxMode === "loading",
  });

  const mockInboxMessages = useMemo(
    () => fakeEmailsToInboxMessages(fakeEmails, handledEmailIds),
    [handledEmailIds],
  );

  const { buckets: mockBuckets } = useStableInboxBuckets({
    messages: mockInboxMessages,
    workflowMode,
    isRefreshing: false,
    isInitialLoading: false,
  });

  const handleCategoryChange = useCallback(
    (id: string, category: InboxAiCategory, options?: InboxCategoryChangeOptions) => {
      if (options?.scope === "sender" && options.sender) {
        setGmailMessages((prev) => {
          const { messages, affectedIds } = applySenderRuleToMessages(
            prev,
            options.sender!,
            category,
          );
          setCategoryOverrides((ov) => {
            const next = { ...ov };
            for (const affectedId of affectedIds) {
              next[affectedId] = category;
            }
            return next;
          });
          return messages;
        });
        return;
      }

      setCategoryOverrides((prev) => ({ ...prev, [id]: category }));
      setGmailMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, category, categorySource: "manual_override" as const }
            : m,
        ),
      );
    },
    [],
  );

  const handleResetCategoryOverride = useCallback(
    async (id: string) => {
      await removeEmailOverrideFromAccount(id);
      setCategoryOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      void loadInbox({ silent: true });
    },
    [loadInbox],
  );

  const activeBuckets = inboxMode === "gmail" ? gmailBuckets : mockBuckets;

  const todayAttentionCount = activeBuckets.todayAttentionCount;
  const importantEmailLabel =
    todayAttentionCount === 1
      ? `1 ${ui.home.attentionCountSingle}`
      : `${todayAttentionCount} ${ui.home.attentionCountPlural}`;

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        {inboxLoading ? (
          <section className="mb-8 mt-6 flex min-h-48 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-6 py-12 shadow-sm">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-medium text-gray-500">
                {ui.home.organizingInbox}
              </h2>
              <p
                className={`text-sm text-gray-500 transition-opacity duration-500 ${
                  showMicroMessage ? "opacity-100" : "opacity-0"
                }`}
              >
                {loadingMicroMessages[messageIndex]}
              </p>
            </div>
          </section>
        ) : (
          <section
            className={`mb-8 space-y-2 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 text-left shadow-sm transition-opacity duration-500 sm:p-7 ${
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
                {ui.home.todayTitle}
              </h2>
              <div className="w-full max-w-[220px] space-y-1 sm:w-auto">
                <label
                  htmlFor="app-language"
                  className="block text-xs font-medium uppercase tracking-[0.08em] text-gray-500"
                >
                  {ui.home.appLanguageLabel}
                </label>
                <select
                  id="app-language"
                  value={uiLanguage}
                  onChange={(event) => setUiLanguage(event.target.value as "en" | "it")}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A] outline-none transition-all duration-200 focus:border-[#6366F1]"
                >
                  <option value="en">{ui.home.appLanguageEnglish}</option>
                  <option value="it">{ui.home.appLanguageItalian}</option>
                </select>
              </div>
            </div>
            <p className="flex flex-wrap items-baseline gap-2 text-base font-medium text-[#0F172A]">
              {isCountsPending && inboxMode === "gmail" ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-normal text-gray-400">
                  <span
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent"
                    aria-hidden
                  />
                  Updating counts…
                </span>
              ) : null}
              <span className={isCountsPending && inboxMode === "gmail" ? "opacity-70" : ""}>
                {importantEmailLabel}
              </span>
            </p>
            <p className="text-sm text-gray-500">{ui.home.everythingHandled}</p>
            {inboxMode === "gmail" && (
              <p className="text-xs text-gray-400">
                Inbox synced from Gmail (read-only). Sections use AI triage (sender, subject, and
                snippet only).
              </p>
            )}
          </section>
        )}

        <header
          className={`rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm transition-opacity duration-500 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
                {ui.home.brandTag}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <AuthNav />
                <Link
                  href="/settings"
                  className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#6366F1] transition-all duration-200 hover:bg-[#F8FAFC] active:scale-95"
                >
                  {ui.home.settingsButton}
                </Link>
              </div>
            </div>
            <p className="text-sm font-semibold tracking-[0.01em] text-[#4F46E5] [text-shadow:0_1px_0_rgba(255,255,255,0.8),0_6px_16px_rgba(79,70,229,0.14)]">
              {ui.home.quickTopLine}
            </p>
            <h1 className="text-3xl font-semibold text-[#0F172A]">
              {ui.home.heroTitle}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
              {ui.home.heroDescription}
            </p>
          </div>
        </header>

        <section
          className={`space-y-8 transition-opacity duration-500 ${
            inboxLoading ? "opacity-100" : showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          {inboxMode === "loading" ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-medium text-[#0F172A]">
                <SectionIcon title="Needs Your Attention" />
                Loading inbox…
              </h2>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <EmailCardSkeleton key={`sk-${i}`} />
                ))}
              </div>
            </div>
          ) : inboxMode === "no_google" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-amber-900">Connect Gmail</h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-800">
                Sign in with Google (same account) so Handled can load your inbox with read-only
                access.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Continue with Google
              </Link>
            </div>
          ) : inboxMode === "gmail_error" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-red-800">Couldn&apos;t load Gmail</h2>
              <p className="mt-2 text-sm text-red-700">{gmailError}</p>
              <button
                type="button"
                onClick={() => void loadInbox()}
                className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Try again
              </button>
            </div>
          ) : inboxMode === "gmail_empty" ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-medium text-[#0F172A]">
                <SectionIcon title="Needs Your Attention" />
                Inbox
              </h2>
              <p className="text-sm text-gray-500">No messages in your Gmail inbox.</p>
            </div>
          ) : inboxMode === "gmail" ? (
            <div className="space-y-10">
              <WorkflowModeBanner mode={workflowMode} />
              <DailyWorkspacePanel messages={messagesWithOverrides} />
              <ContextualSearchPanel messages={messagesWithOverrides} />
              <DailyBriefingPanel messages={messagesWithOverrides} />
              <ProactiveSuggestionsPanel
                messages={messagesWithOverrides}
                locale={uiLanguage === "it" ? "it" : "en"}
              />
              <FollowUpsSection
                messages={gmailMessages}
                locale={uiLanguage === "it" ? "it" : "en"}
              />
              <InboxSyncBar
                lastSyncedAt={lastSyncedAt}
                isRefreshing={isRefreshing}
                onRefresh={() => void loadInbox({ silent: true })}
              />
              <InboxTrainingBanner
                messages={gmailBuckets.allVisible as GmailCardMessage[]}
                onCategoryChange={handleCategoryChange}
              />
              {gmailBuckets.showClutterSection ? (
                <InboxClutterSection
                  messages={gmailBuckets.clutterEmails as GmailCardMessage[]}
                  locale={uiLanguage === "it" ? "it" : "en"}
                  onCategoryChange={handleCategoryChange}
                  defaultCollapsed
                />
              ) : null}
              {gmailBuckets.categoryOrder.map((category) => {
                const list = gmailBuckets.byCategory[category];
                if (!list.length) return null;
                return (
                  <div
                    key={category}
                    className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm transition-all duration-200"
                  >
                    <GmailCategorySectionHeader
                      category={category}
                      locale={uiLanguage}
                      count={gmailBuckets.counts[category]}
                    />
                    <div className="mt-6 space-y-4">
                      {list.map((message) => (
                        <div
                          key={message.id}
                          className={`transition-opacity duration-500 ${
                            showContent ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <GmailInboxCard
                            message={message}
                            locale={uiLanguage === "it" ? "it" : "en"}
                            onCategoryChange={handleCategoryChange}
                            onResetOverride={handleResetCategoryOverride}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            inboxSections.map((section, index) => (
              <div
                key={section.title}
                className={index > 0 ? "border-t border-gray-200 pt-8" : undefined}
              >
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm transition-all duration-200">
                  <h2 className="mb-5 flex items-center gap-2 text-lg font-medium text-[#0F172A]">
                    <SectionIcon title={section.title} />
                    {getSectionLabel(section.title, ui)}
                  </h2>
                  <div className="space-y-4">
                    {section.title === "Needs Your Attention" &&
                    section.emails.length === 0 ? (
                      <EmptyNeedsAttentionState show={showContent} />
                    ) : section.title === "Handled For You" &&
                      section.emails.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        You&apos;re all caught up. New handled suggestions will appear here when
                        they&apos;re ready.
                      </div>
                    ) : (
                      section.emails.map((email) => (
                        <div
                          key={email.id}
                          className={`transition-opacity duration-500 ${
                            showContent ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <MockEmailCard
                            highlighted={section.title === "Needs Your Attention"}
                            {...email}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        {inboxMode === "mock" && handledTodayEmails.length > 0 ? (
          <section
            className={`space-y-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm transition-opacity duration-500 ${
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <SectionIcon title="Handled For You" />
                {ui.home.handledToday}
              </h2>
              <p className="text-xs text-gray-500">
                {handledTodayEmails.length} {ui.home.completedSuffix}
              </p>
            </div>
            <div className="space-y-2">
              {handledTodayEmails.slice(-3).map((email) => (
                <HandledTodayItem
                  key={`handled-${email.id}`}
                  id={email.id}
                  sender={email.sender}
                  subject={email.subject}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
