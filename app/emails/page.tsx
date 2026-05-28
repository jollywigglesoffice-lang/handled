"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fakeEmails,
  getInboxSections,
  type FakeEmail,
  type InboxSectionTitle,
} from "@/lib/fake-emails";
import { ensureApiSessionCookies } from "@/lib/auth/ensure-api-session";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { saveGoogleProviderToken } from "@/lib/google-provider-token";
import { useHandledEmails } from "@/app/handled-emails-context";
import { AuthNav } from "@/app/components/auth-nav";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import { resolveAllInboxMessagesForDisplay } from "@/lib/final-category-resolution";
import {
  loadClientSenderPreferences,
  senderPreferencesToRules,
} from "@/lib/inbox-sender-preferences";
import { syncSenderPreferencesFromAccount } from "@/lib/sender-rules/client-sync";
import { logSenderRuleDebug, resolveSenderIdentity } from "@/lib/sender-identity";
import {
  loadClientEmailOverrideMap,
  loadClientEmailOverrides,
  saveClientEmailOverrides,
  upsertClientEmailOverride,
} from "@/lib/email-overrides/client-storage";
import { stampEmailOverridesOnMessages } from "@/lib/email-overrides/apply-to-messages";
import {
  mergeEmailOverridesLocalWins,
  overridesToCategoryMap,
} from "@/lib/email-overrides/storage";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";
import {
  persistEmailOverrideToAccount,
  removeEmailOverrideFromAccount,
  syncEmailOverridesFromAccount,
} from "@/lib/email-overrides/client-sync";
import { syncSenderRelationshipsFromAccount } from "@/lib/relationship-intelligence/client-sync";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import { fakeEmailsToInboxMessages } from "@/lib/inbox-buckets-mock";
import { syncWorkflowModeFromAccount } from "@/lib/workflow-mode/client-sync";
import { InboxSecondaryTools } from "@/app/emails/inbox-secondary-tools";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";
import { InboxClutterSection } from "@/app/emails/inbox-clutter-section";
import { useStableInboxBuckets } from "@/app/emails/use-stable-inbox-buckets";
import { GmailInboxCard, type GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { InboxSyncBar } from "@/app/emails/inbox-sync-bar";
import { CalmTypingIndicator } from "@/app/components/calm-loading";
import {
  calmSectionCountLabel,
  calmTodayHeadline,
  loadingRhythmMessages,
  pickFocusReassurance,
  type AttentionSnapshot,
} from "@/lib/attention-calm";
import { healthyCompletionState } from "@/lib/daily-rhythm";
import { calmInboxErrorFromRaw } from "@/lib/calm-messages";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";
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
        className="h-4 w-4 text-accent"
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
        className="h-4 w-4 text-accent"
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
      className="h-4 w-4 text-accent"
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
  const common = "h-5 w-5 shrink-0 text-accent";
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
  const isPrimary =
    category === "needs_attention" ||
    category === "quick_reply" ||
    category === "handled";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {isPrimary ? (
          <GmailSectionLeadingIcon category={category} />
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {inboxCategorySectionTitle(category, locale)}
          </h2>
          {subtitle && isPrimary ? (
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <span className="text-xs text-gray-400">
        {calmSectionCountLabel(count, category, locale)}
      </span>
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
      className={`block rounded-xl border p-4 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md sm:p-5 ${
        highlighted
          ? "border-[#C7D2FE] bg-accent-muted/40 hover:border-[#A5B4FC]"
          : "border-[#E2E8F0] bg-[#FFFFFF] hover:border-accent/40"
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
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-sm sm:p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-40 rounded-lg subtle-shimmer" />
          <div className="h-4 w-20 rounded-lg subtle-shimmer" />
        </div>
        <div className="h-6 w-3/4 rounded-lg subtle-shimmer" />
        <div className="h-4 w-full rounded-lg subtle-shimmer" />
        <div className="h-3 w-2/3 rounded-lg subtle-shimmer" />
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

function EmptyNeedsAttentionState({ show, locale }: { show: boolean; locale: "en" | "it" }) {
  const completion = healthyCompletionState(locale);

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
      <p className="text-xl font-medium text-[#0F172A]">{completion.title}</p>
      <p className="text-sm leading-relaxed text-gray-500">{completion.subtitle}</p>
      {completion.footer ? (
        <p className="pt-1 text-xs text-gray-400">{completion.footer}</p>
      ) : null}
    </div>
  );
}

export default function EmailsInboxPage() {
  const ui = useUiCopy();
  const { uiLanguage, setUiLanguage } = useUserPreferences();
  const loadingMicroMessages = useMemo(
    () => loadingRhythmMessages(uiLanguage === "it" ? "it" : "en"),
    [uiLanguage],
  );
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
    {},
  );
  const [senderPrefsVersion, setSenderPrefsVersion] = useState(0);
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

    const hasSession = await ensureApiSessionCookies();

    try {
      if (!hasSession) {
        setInboxMode("mock");
        return;
      }

      const res = await fetch("/api/gmail/messages", {
        credentials: "include",
        headers: await inboxFetchHeaders(),
      });
      const body = (await res.json()) as {
        messages?: GmailInboxMessage[];
        categoryOverrides?: Record<string, InboxAiCategory>;
        emailOverrideRecords?: EmailCategoryOverride[];
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
      const localRecords = loadClientEmailOverrides();
      const serverRecords =
        body.emailOverrideRecords ??
        Object.entries(body.categoryOverrides ?? {}).map(([emailId, overriddenCategory]) => ({
          emailId,
          originalCategory: null,
          overriddenCategory,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      const mergedRecords = mergeEmailOverridesLocalWins(localRecords, serverRecords);
      const mergedOverrideMap = overridesToCategoryMap(mergedRecords);
      saveClientEmailOverrides(mergedRecords);
      setCategoryOverrides(mergedOverrideMap);

      const stampedMsgs = stampEmailOverridesOnMessages(msgs, mergedOverrideMap);
      setGmailMessages(stampedMsgs);

      for (const local of localRecords) {
        const server = serverRecords.find((s) => s.emailId === local.emailId);
        if (
          !server ||
          new Date(local.updatedAt).getTime() > new Date(server.updatedAt).getTime()
        ) {
          void persistEmailOverrideToAccount({
            emailId: local.emailId,
            overriddenCategory: local.overriddenCategory,
            originalCategory: local.originalCategory,
          });
        }
      }
      setInboxMode(msgs.length ? "gmail" : "gmail_empty");
      setLastSyncedAt(new Date().toISOString());
    } catch (e) {
      console.error("[inbox] gmail load", e);
      setGmailError("Network error while loading inbox.");
      setInboxMode("gmail_error");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setCategoryOverrides(loadClientEmailOverrideMap());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (session?.provider_token) {
        saveGoogleProviderToken(session.provider_token);
      }
      const [mode, overrides, senderPrefs] = await Promise.all([
        syncWorkflowModeFromAccount(),
        session ? syncEmailOverridesFromAccount() : Promise.resolve(loadClientEmailOverrideMap()),
        session ? syncSenderRelationshipsFromAccount() : Promise.resolve([]),
        session ? syncSenderPreferencesFromAccount() : Promise.resolve(loadClientSenderPreferences()),
      ]);
      if (cancelled) return;
      setWorkflowMode(mode);
      setCategoryOverrides(overrides);
      setSenderPrefsVersion((v) => v + 1);
      logSenderRuleDebug("inbox persistence ready", {
        overrideCount: Object.keys(overrides).length,
        senderPrefCount: senderPrefs.length,
      });
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
    };
    const onSenderPrefsChange = async () => {
      await syncSenderPreferencesFromAccount();
      setSenderPrefsVersion((v) => v + 1);
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
      window.removeEventListener("handled-sender-preferences-changed", onSenderPrefsChange);
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

  useEffect(() => {
    const bump = () => setSenderPrefsVersion((v) => v + 1);
    window.addEventListener("handled-sender-preferences-changed", bump);
    return () => window.removeEventListener("handled-sender-preferences-changed", bump);
  }, []);

  const categoryResolutionContext = useMemo(() => {
    const fromStorage = loadClientEmailOverrideMap();
    return {
      emailOverrides: { ...fromStorage, ...categoryOverrides },
      senderRules: senderPreferencesToRules(loadClientSenderPreferences()),
    };
  }, [categoryOverrides, senderPrefsVersion]);

  const messagesWithOverrides = useMemo(
    () => resolveAllInboxMessagesForDisplay(gmailMessages, categoryResolutionContext),
    [gmailMessages, categoryResolutionContext],
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
        logSenderRuleDebug("handleCategoryChange sender scope", {
          emailId: id,
          ...resolveSenderIdentity(options.sender),
          category,
        });
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

      const now = new Date().toISOString();
      upsertClientEmailOverride({
        emailId: id,
        originalCategory: null,
        overriddenCategory: category,
        createdAt: now,
        updatedAt: now,
      });
      setCategoryOverrides((prev) => ({ ...prev, [id]: category }));
      setGmailMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, category, categorySource: "manual_override" as const }
            : m,
        ),
      );
      void persistEmailOverrideToAccount({
        emailId: id,
        overriddenCategory: category,
      });
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

  const inboxLocale = uiLanguage === "it" ? "it" : "en";
  const attentionSnapshot: AttentionSnapshot = useMemo(
    () => ({
      needsAttention: activeBuckets.todayAttentionCount,
      quickReply: activeBuckets.quickReplyEmails.length,
      handled: activeBuckets.handledEmails.length,
      newsletter: activeBuckets.newsletterEmails.length,
      promotion: activeBuckets.promotionEmails.length,
      clutter: activeBuckets.clutterCount,
      totalVisible: activeBuckets.allVisible.length,
    }),
    [activeBuckets],
  );
  const todayHeadline = calmTodayHeadline(attentionSnapshot, inboxLocale);
  const reliefMessage = useMemo(
    () => (inboxLoading ? null : pickFocusReassurance(attentionSnapshot, inboxLocale)),
    [inboxLoading, attentionSnapshot, inboxLocale],
  );
  const calmGmailError = calmInboxErrorFromRaw(
    gmailError,
    uiLocaleFromLanguage(uiLanguage),
  );

  const workflowProfile = getWorkflowModeProfile(workflowMode);

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <header
          className={`flex flex-wrap items-start justify-between gap-4 transition-opacity duration-500 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {ui.home.todayTitle}
            </h1>
            {!inboxLoading ? (
              <div className="space-y-1">
                <p className="text-sm text-gray-500">
                  {isCountsPending && inboxMode === "gmail" ? (
                    <span className="mr-2 inline-flex items-center gap-1.5" aria-hidden>
                      <span className="calm-accent-pulse h-2 w-2 rounded-full" />
                    </span>
                  ) : null}
                  <span className="font-medium text-gray-700">{todayHeadline}</span>
                  <span className="text-gray-400"> · {workflowProfile.label}</span>
                </p>
                {reliefMessage ? (
                  <p className="text-xs text-gray-400 transition-opacity duration-500 calm-fade-in">
                    {reliefMessage}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{ui.home.organizingInbox}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="app-language" className="sr-only">
              {ui.home.appLanguageLabel}
            </label>
            <select
              id="app-language"
              value={uiLanguage}
              onChange={(event) => setUiLanguage(event.target.value as "en" | "it")}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent"
            >
              <option value="en">{ui.home.appLanguageEnglish}</option>
              <option value="it">{ui.home.appLanguageItalian}</option>
            </select>
            <AuthNav />
            <Link href="/settings" className="link-accent text-xs">
              {ui.home.settingsButton}
            </Link>
          </div>
        </header>

        {inboxLoading ? (
          <section className="mt-10 space-y-6 calm-fade-in">
            <div className="flex min-h-16 items-center justify-center gap-3">
              <CalmTypingIndicator />
              <p
                className={`text-sm text-gray-400 transition-opacity duration-500 ${
                  showMicroMessage ? "opacity-100" : "opacity-0"
                }`}
              >
                {loadingMicroMessages[messageIndex]}
              </p>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <EmailCardSkeleton key={`load-sk-${i}`} />
              ))}
            </div>
          </section>
        ) : null}

        <section
          className={`mt-10 space-y-8 transition-opacity duration-500 ${
            inboxLoading ? "opacity-100" : showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          {inboxMode === "loading" ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-medium text-[#0F172A]">
                <SectionIcon title="Needs Your Attention" />
                {ui.home.inboxLoadingTitle}
              </h2>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <EmailCardSkeleton key={`sk-${i}`} />
                ))}
              </div>
            </div>
          ) : inboxMode === "no_google" ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">{ui.home.connectGmailTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {ui.home.connectGmailBody}
              </p>
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
              >
                Continue with Google
              </Link>
            </div>
          ) : inboxMode === "gmail_error" ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">{ui.home.inboxErrorTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{calmGmailError}</p>
              <button
                type="button"
                onClick={() => void loadInbox()}
                className="btn-primary-sm mt-4"
              >
                {ui.calm.errors.tryAgain}
              </button>
            </div>
          ) : inboxMode === "gmail_empty" ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-medium text-[#0F172A]">
                <SectionIcon title="Needs Your Attention" />
                Inbox
              </h2>
              <p className="text-sm leading-relaxed text-gray-600">{ui.home.emptyGmailInbox}</p>
            </div>
          ) : inboxMode === "gmail" ? (
            <div className="space-y-8">
              <InboxSyncBar
                lastSyncedAt={lastSyncedAt}
                isRefreshing={isRefreshing}
                onRefresh={() => void loadInbox({ silent: true })}
              />
              {gmailBuckets.categoryOrder.map((category) => {
                const list = gmailBuckets.byCategory[category];
                if (!list.length) return null;
                return (
                  <section key={category} className="space-y-3">
                    <GmailCategorySectionHeader
                      category={category}
                      locale={uiLanguage}
                      count={gmailBuckets.counts[category]}
                    />
                    <div className="space-y-2">
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
                  </section>
                );
              })}
              {gmailBuckets.showClutterSection ? (
                <InboxClutterSection
                  messages={gmailBuckets.clutterEmails as GmailCardMessage[]}
                  locale={uiLanguage === "it" ? "it" : "en"}
                  onCategoryChange={handleCategoryChange}
                  defaultCollapsed
                />
              ) : null}
              <InboxSecondaryTools
                messages={messagesWithOverrides as GmailCardMessage[]}
                gmailMessages={gmailMessages as GmailCardMessage[]}
                allVisible={gmailBuckets.allVisible as GmailCardMessage[]}
                locale={uiLanguage === "it" ? "it" : "en"}
                onCategoryChange={handleCategoryChange}
              />
            </div>
          ) : (
            inboxSections.map((section) => (
              <section key={section.title} className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <SectionIcon title={section.title} />
                    {getSectionLabel(section.title, ui)}
                  </h2>
                  <div className="space-y-2">
                    {section.title === "Needs Your Attention" &&
                    section.emails.length === 0 ? (
                      <EmptyNeedsAttentionState
                        show={showContent}
                        locale={uiLanguage === "it" ? "it" : "en"}
                      />
                    ) : section.title === "Handled For You" &&
                      section.emails.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600">
                        {ui.home.handledSectionEmpty}
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
              </section>
            ))
          )}
        </section>

        {inboxMode === "mock" && handledTodayEmails.length > 0 ? (
          <section
            className={`space-y-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-sm transition-opacity duration-500 sm:p-5 ${
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
