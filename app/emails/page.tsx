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
import { InboxEmptyState } from "@/app/emails/inbox-empty-state";
import {
  categoryEmptyMessage,
  inboxCompletionCopy,
  rotatingCompletionSeed,
} from "@/lib/empty-states";
import { calmInboxErrorFromRaw } from "@/lib/calm-messages";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";
import {
  type CategorySource,
  type InboxAiCategory,
  inboxCategorySectionSubtitle,
  inboxCategorySectionTitle,
  normalizeInboxAiCategory,
  INBOX_AI_CATEGORY_VALUES,
} from "@/lib/inbox-ai-categories";
import { applySenderRuleToMessages } from "@/lib/sender-rules/apply-to-messages";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import { buildCategoryUndoSnapshot } from "@/lib/category-undo/snapshot";
import {
  mergeUndoMessages,
  persistCategoryUndo,
} from "@/lib/category-undo/persist-undo";
import { saveClientSenderPreferences } from "@/lib/inbox-sender-preferences";
import { CategoryUndoToast } from "@/app/emails/category-undo-toast";
import { useCategoryUndo } from "@/app/emails/use-category-undo";
import { useInboxSelection } from "@/app/emails/use-inbox-selection";
import { BulkActionBar } from "@/app/emails/bulk-action-bar";
import {
  loadReadStateMap,
  READ_STATE_EVENT,
  type ReadStateMap,
} from "@/lib/read-state/client-storage";
import { markEmailsRead, markEmailsUnread } from "@/lib/read-state/gmail-sync";
import {
  loadDismissedIds,
  addDismissedIds,
  removeDismissedIds,
  DISMISSED_EVENT,
} from "@/lib/dismissed/client-storage";
import { trackEvent } from "@/lib/analytics";
import { InboxSummaryCard } from "@/app/emails/inbox-summary-card";
import { InboxZeroMode, type InboxZeroStep } from "@/app/emails/inbox-zero-mode";
import { CategoryTabs, type CategoryTab } from "@/app/emails/category-tabs";

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

const CATEGORY_TAB_KEY = "handled_category_tab_v1";
const VALID_TABS: ReadonlySet<string> = new Set([
  "all",
  ...INBOX_AI_CATEGORY_VALUES,
]);

function loadCategoryTab(): CategoryTab {
  if (typeof window === "undefined") return "all";
  try {
    const raw = localStorage.getItem(CATEGORY_TAB_KEY);
    if (raw && VALID_TABS.has(raw)) return raw as CategoryTab;
  } catch {
    /* ignore */
  }
  return "all";
}

function saveCategoryTab(tab: CategoryTab): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATEGORY_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

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
  if (category === "fyi") {
    return (
      <svg aria-hidden className={common} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="6.6" r="0.9" fill="currentColor" />
        <path d="M10 9.4v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  onSelectAll,
}: {
  category: InboxAiCategory;
  locale: "en" | "it";
  count: number;
  onSelectAll?: () => void;
}) {
  const subtitle = inboxCategorySectionSubtitle(category, locale);
  const isPrimary =
    category === "needs_attention" ||
    category === "quick_reply" ||
    category === "fyi" ||
    category === "handled";

  return (
    <div className="group/section flex flex-wrap items-baseline justify-between gap-2">
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
      <div className="flex items-center gap-3">
        {onSelectAll && count > 0 ? (
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-md px-1.5 py-0.5 text-xs font-medium text-gray-400 opacity-0 transition hover:text-accent focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 group-hover/section:opacity-100"
          >
            {locale === "it" ? "Seleziona tutte" : "Select all"}
          </button>
        ) : null}
        <span className="text-xs text-gray-400">
          {calmSectionCountLabel(count, category, locale)}
        </span>
      </div>
    </div>
  );
}

function GmailCategorySection({
  category,
  list,
  uiLanguage,
  count,
  onSelectAll,
  showContent,
  selection,
  readStateMap,
  onCategoryChange,
  onResetOverride,
}: {
  category: InboxAiCategory;
  list: GmailCardMessage[];
  uiLanguage: "en" | "it";
  count: number;
  onSelectAll: () => void;
  showContent: boolean;
  selection: ReturnType<typeof useInboxSelection>;
  readStateMap: ReadStateMap;
  onCategoryChange: (
    id: string,
    category: InboxAiCategory,
    options?: InboxCategoryChangeOptions,
  ) => void;
  onResetOverride: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <GmailCategorySectionHeader
        category={category}
        locale={uiLanguage}
        count={count}
        onSelectAll={onSelectAll}
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
              onCategoryChange={onCategoryChange}
              onResetOverride={onResetOverride}
              selected={selection.isSelected(message.id)}
              selectionMode={selection.selectionMode}
              onToggleSelect={selection.toggle}
              isUnread={readStateMap[message.id] === "unread"}
            />
          </div>
        ))}
      </div>
    </section>
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
    <InboxEmptyState
      show={show}
      tone="attention"
      title={completion.title}
      subtitle={completion.subtitle}
      footer={completion.footer}
    />
  );
}

export default function EmailsInboxPage() {
  const ui = useUiCopy();
  const { uiLanguage, setUiLanguage } = useUserPreferences();
  const loadingMicroMessages = useMemo(
    () => loadingRhythmMessages(uiLanguage === "it" ? "it" : "en"),
    [uiLanguage],
  );
  const { handledEmailIds, markEmailHandled } = useHandledEmails();

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
  // Pagination plumbing (Gmail nextPageToken). UI only exposes a manual
  // "load more" for now — no infinite scroll yet.
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showMicroMessage, setShowMicroMessage] = useState(true);

  const loadInbox = useCallback(
    async (options?: { silent?: boolean; pageToken?: string | null; append?: boolean }) => {
    const append = Boolean(options?.append);
    if (!options?.silent && !append) {
      setInboxMode("loading");
    }
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
    }
    setGmailError("");

    const hasSession = await ensureApiSessionCookies();

    try {
      if (!hasSession) {
        setInboxMode("mock");
        return;
      }

      const url = options?.pageToken
        ? `/api/gmail/messages?pageToken=${encodeURIComponent(options.pageToken)}`
        : "/api/gmail/messages";
      const res = await fetch(url, {
        credentials: "include",
        headers: await inboxFetchHeaders(),
      });
      const body = (await res.json()) as {
        messages?: GmailInboxMessage[];
        categoryOverrides?: Record<string, InboxAiCategory>;
        emailOverrideRecords?: EmailCategoryOverride[];
        nextPageToken?: string | null;
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
      if (append) {
        setGmailMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const additions = stampedMsgs.filter((m) => !seen.has(m.id));
          return [...prev, ...additions];
        });
      } else {
        setGmailMessages(stampedMsgs);
      }
      setNextPageToken(body.nextPageToken ?? null);

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
      if (append) {
        setInboxMode("gmail");
      } else {
        setInboxMode(msgs.length ? "gmail" : "gmail_empty");
      }
      setLastSyncedAt(new Date().toISOString());
    } catch (e) {
      console.error("[inbox] gmail load", e);
      if (!append) {
        setGmailError("Network error while loading inbox.");
        setInboxMode("gmail_error");
      }
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  },
  [],
);

  const handleLoadMore = useCallback(() => {
    if (!nextPageToken || isLoadingMore) return;
    trackEvent("inbox_load_more", { has_token: true });
    void loadInbox({ pageToken: nextPageToken, append: true });
  }, [nextPageToken, isLoadingMore, loadInbox]);

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

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const sync = () => setDismissedIds(loadDismissedIds());
    sync();
    window.addEventListener(DISMISSED_EVENT, sync);
    return () => window.removeEventListener(DISMISSED_EVENT, sync);
  }, []);

  const messagesWithOverrides = useMemo(() => {
    const visible =
      dismissedIds.size === 0
        ? gmailMessages
        : gmailMessages.filter((m) => !dismissedIds.has(m.id));
    return resolveAllInboxMessagesForDisplay(visible, categoryResolutionContext);
  }, [gmailMessages, categoryResolutionContext, dismissedIds]);

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

  const inboxLocale = uiLanguage === "it" ? "it" : "en";

  const completionCopy = useMemo(
    () => inboxCompletionCopy(inboxLocale, rotatingCompletionSeed()),
    [inboxLocale],
  );

  const {
    active: undoToast,
    undoMessage,
    undoLabel,
    offerCategoryUndo,
    offerActionUndo,
    performUndo,
    dismiss: dismissUndoToast,
    registerUndoHandler,
  } = useCategoryUndo(inboxLocale);

  useEffect(() => {
    registerUndoHandler(async (snapshot) => {
      setGmailMessages((prev) => mergeUndoMessages(prev, snapshot));
      setCategoryOverrides(snapshot.previousOverrides);
      saveClientEmailOverrides(snapshot.previousEmailOverrides);
      saveClientSenderPreferences(snapshot.previousSenderPrefs);
      setSenderPrefsVersion((v) => v + 1);
      await persistCategoryUndo(snapshot);
    });
  }, [registerUndoHandler]);

  const selection = useInboxSelection();

  const [readStateMap, setReadStateMap] = useState<ReadStateMap>({});
  useEffect(() => {
    const sync = () => setReadStateMap(loadReadStateMap());
    sync();
    window.addEventListener(READ_STATE_EVENT, sync);
    return () => window.removeEventListener(READ_STATE_EVENT, sync);
  }, []);

  const [activeCategoryTab, setActiveCategoryTab] = useState<CategoryTab>(() =>
    loadCategoryTab(),
  );
  const handleCategoryTabChange = useCallback((tab: CategoryTab) => {
    setActiveCategoryTab(tab);
    saveCategoryTab(tab);
  }, []);

  // Core move: persist overrides + update UI for a set of ids. No undo/toast.
  const applyCategoryToIds = useCallback(
    (ids: string[], category: InboxAiCategory) => {
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      for (const id of ids) {
        upsertClientEmailOverride({
          emailId: id,
          originalCategory: null,
          overriddenCategory: category,
          createdAt: now,
          updatedAt: now,
        });
      }

      const idSet = new Set(ids);
      setCategoryOverrides((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = category;
        return next;
      });
      setGmailMessages((prev) =>
        prev.map((m) =>
          idSet.has(m.id)
            ? { ...m, category, categorySource: "manual_override" as const }
            : m,
        ),
      );

      for (const id of ids) {
        void persistEmailOverrideToAccount({ emailId: id, overriddenCategory: category });
      }
    },
    [],
  );

  const handleBulkCategoryChange = useCallback(
    (category: InboxAiCategory) => {
      const ids = [...selection.selectedIds];
      if (ids.length === 0) return;

      const snapshot = buildCategoryUndoSnapshot({
        scope: "this_email",
        triggerEmailId: ids[0],
        newCategory: category,
        messages: gmailMessages,
        categoryOverrides,
        explicitAffectedIds: ids,
      });

      applyCategoryToIds(ids, category);

      trackEvent("bulk_action_used", {
        bulk_action_type: `move:${category}`,
        count: ids.length,
      });
      offerCategoryUndo(snapshot, category, ids.length);
      selection.clear();
    },
    [selection, gmailMessages, categoryOverrides, offerCategoryUndo, applyCategoryToIds],
  );

  const handleBulkMarkRead = useCallback(() => {
    const ids = [...selection.selectedIds];
    markEmailsRead(ids);
    trackEvent("bulk_action_used", { bulk_action_type: "mark_read", count: ids.length });
  }, [selection.selectedIds]);

  const handleBulkMarkUnread = useCallback(() => {
    const ids = [...selection.selectedIds];
    markEmailsUnread(ids);
    trackEvent("bulk_action_used", { bulk_action_type: "mark_unread", count: ids.length });
  }, [selection.selectedIds]);

  const handleSelectAllVisible = useCallback(() => {
    const source =
      activeCategoryTab === "all"
        ? gmailBuckets.allVisible
        : gmailBuckets.byCategory[activeCategoryTab] ?? [];
    selection.selectAll(source.map((m) => m.id));
  }, [selection, gmailBuckets.allVisible, gmailBuckets.byCategory, activeCategoryTab]);

  const handleSelectAllInSection = useCallback(
    (category: InboxAiCategory) => {
      const ids = (gmailBuckets.byCategory[category] ?? []).map((m) => m.id);
      if (ids.length) selection.selectMany(ids);
    },
    [selection, gmailBuckets.byCategory],
  );

  const handleBulkHandled = useCallback(() => {
    handleBulkCategoryChange("handled");
  }, [handleBulkCategoryChange]);

  // Archive / Delete: optimistic local dismissal, fully reversible via undo.
  const dismissSelected = useCallback(
    (actionType: "archive" | "delete") => {
      const ids = [...selection.selectedIds];
      if (ids.length === 0) return;

      addDismissedIds(ids);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      if (actionType === "archive") {
        for (const id of ids) markEmailHandled(id);
      }

      trackEvent("bulk_action_used", { bulk_action_type: actionType, count: ids.length });

      const n = ids.length;
      const verb =
        actionType === "archive"
          ? inboxLocale === "it"
            ? n > 1
              ? `${n} email archiviate`
              : "Email archiviata"
            : n > 1
              ? `Archived ${n} emails`
              : "Archived"
          : inboxLocale === "it"
            ? n > 1
              ? `${n} email eliminate`
              : "Email eliminata"
            : n > 1
              ? `Deleted ${n} emails`
              : "Deleted";

      offerActionUndo({
        message: verb,
        actionType,
        onUndo: () => {
          removeDismissedIds(ids);
          setDismissedIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            return next;
          });
        },
      });
      selection.clear();
    },
    [selection, markEmailHandled, inboxLocale, offerActionUndo],
  );

  const handleBulkArchive = useCallback(() => dismissSelected("archive"), [dismissSelected]);
  const handleBulkDelete = useCallback(() => dismissSelected("delete"), [dismissSelected]);

  // ---- Inbox Zero enhancement layer ----
  const [zeroSession, setZeroSession] = useState<{
    mode: "quick_replies" | "inbox_zero";
    steps: InboxZeroStep[];
  } | null>(null);

  // One-click: move all visible promotions to Handled, with undo.
  const handleClearPromotions = useCallback(() => {
    const ids = (gmailBuckets.byCategory.promotion ?? []).map((m) => m.id);
    if (ids.length === 0) return;

    const snapshot = buildCategoryUndoSnapshot({
      scope: "this_email",
      triggerEmailId: ids[0],
      newCategory: "handled",
      messages: gmailMessages,
      categoryOverrides,
      explicitAffectedIds: ids,
    });

    applyCategoryToIds(ids, "handled");
    trackEvent("clear_promotions_used", { count: ids.length });

    const message =
      inboxLocale === "it"
        ? `${ids.length} email svuotate`
        : `${ids.length} email${ids.length === 1 ? "" : "s"} cleared`;
    offerCategoryUndo(snapshot, "handled", ids.length, message);
    selection.clear();
  }, [
    gmailBuckets.byCategory,
    gmailMessages,
    categoryOverrides,
    applyCategoryToIds,
    offerCategoryUndo,
    inboxLocale,
    selection,
  ]);

  const handleStartQuickReplies = useCallback(() => {
    const emails = gmailBuckets.byCategory.quick_reply ?? [];
    if (emails.length === 0) return;
    const steps: InboxZeroStep[] = emails.map((message) => ({
      kind: "email",
      category: "quick_reply",
      message: message as GmailCardMessage,
    }));
    trackEvent("quick_reply_queue_started", { count: emails.length });
    setZeroSession({ mode: "quick_replies", steps });
  }, [gmailBuckets.byCategory]);

  const handleStartInboxZero = useCallback(() => {
    const quickReplies = gmailBuckets.byCategory.quick_reply ?? [];
    const needsAttention = gmailBuckets.byCategory.needs_attention ?? [];
    const promotions = gmailBuckets.byCategory.promotion ?? [];

    const steps: InboxZeroStep[] = [
      ...quickReplies.map((message) => ({
        kind: "email" as const,
        category: "quick_reply" as const,
        message: message as GmailCardMessage,
      })),
      ...needsAttention.map((message) => ({
        kind: "email" as const,
        category: "needs_attention" as const,
        message: message as GmailCardMessage,
      })),
    ];
    if (promotions.length > 0) {
      steps.push({ kind: "cleanup", emails: promotions as GmailCardMessage[] });
    }
    if (steps.length === 0) return;

    trackEvent("inbox_zero_started", { steps: steps.length });
    setZeroSession({ mode: "inbox_zero", steps });
  }, [gmailBuckets.byCategory]);

  // Completing an email in a session clears it from the inbox (reversible via dismissed store).
  const completeEmailInZero = useCallback(
    (id: string) => {
      addDismissedIds([id]);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      markEmailHandled(id);
      markEmailsRead([id]);
    },
    [markEmailHandled],
  );

  const clearPromotionsInZero = useCallback(
    (ids: string[]) => {
      applyCategoryToIds(ids, "handled");
      trackEvent("clear_promotions_used", { count: ids.length, source: "inbox_zero" });
    },
    [applyCategoryToIds],
  );

  const handleZeroFinished = useCallback(
    (stats: { processed: number; timeSavedSeconds: number }) => {
      if (zeroSession?.mode === "inbox_zero") {
        trackEvent("inbox_zero_completed", {
          processed: stats.processed,
          time_saved_seconds: stats.timeSavedSeconds,
        });
      }
    },
    [zeroSession?.mode],
  );

  // Bulk keyboard shortcuts. (Esc → clear is handled in useInboxSelection.)
  useEffect(() => {
    if (inboxMode !== "gmail" || zeroSession) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const hasSelection = selection.count > 0;

      if (key === "a") {
        e.preventDefault();
        handleSelectAllVisible();
        return;
      }
      if (!hasSelection) return;

      if (key === "h") {
        e.preventDefault();
        handleBulkHandled();
      } else if (key === "p") {
        e.preventDefault();
        handleBulkCategoryChange("promotion");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleBulkArchive();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    inboxMode,
    zeroSession,
    selection.count,
    handleSelectAllVisible,
    handleBulkHandled,
    handleBulkCategoryChange,
    handleBulkArchive,
  ]);

  const handleCategoryChange = useCallback(
    (id: string, category: InboxAiCategory, options?: InboxCategoryChangeOptions) => {
      const scope = options?.scope ?? "this_email";

      const snapshot = buildCategoryUndoSnapshot({
        scope,
        triggerEmailId: id,
        senderLine: options?.sender,
        newCategory: category,
        messages: gmailMessages,
        categoryOverrides,
      });

      if (scope === "sender" && options?.sender) {
        logSenderRuleDebug("handleCategoryChange sender scope", {
          emailId: id,
          ...resolveSenderIdentity(options.sender),
          category,
        });
        const { messages, affectedIds } = applySenderRuleToMessages(
          gmailMessages,
          options.sender,
          category,
        );
        setGmailMessages(messages);
        setCategoryOverrides((ov) => {
          const next = { ...ov };
          for (const affectedId of affectedIds) {
            next[affectedId] = category;
          }
          return next;
        });
      } else {
        const now = new Date().toISOString();
        upsertClientEmailOverride({
          emailId: id,
          originalCategory: options?.guessedCategory ?? null,
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
          originalCategory: options?.guessedCategory,
        });
      }

      offerCategoryUndo(snapshot, category);
    },
    [gmailMessages, categoryOverrides, offerCategoryUndo],
  );

  const handleResetCategoryOverride = useCallback(
    async (id: string) => {
      dismissUndoToast();
      await removeEmailOverrideFromAccount(id);
      setCategoryOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      void loadInbox({ silent: true });
    },
    [loadInbox, dismissUndoToast],
  );

  const activeBuckets = inboxMode === "gmail" ? gmailBuckets : mockBuckets;

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
            <InboxEmptyState
              tone="calm"
              title={completionCopy.title}
              subtitle={completionCopy.subtitle}
            />
          ) : inboxMode === "gmail" ? (
            <div className="space-y-8">
              <InboxSyncBar
                lastSyncedAt={lastSyncedAt}
                isRefreshing={isRefreshing}
                onRefresh={() => void loadInbox({ silent: true })}
              />
              <p className="text-xs text-gray-400">
                {inboxLocale === "it"
                  ? `Mostrando le ${gmailMessages.length} email più recenti`
                  : `Showing newest ${gmailMessages.length} inbox emails`}
              </p>
              <InboxSummaryCard
                counts={gmailBuckets.counts}
                locale={inboxLocale}
                onClearPromotions={handleClearPromotions}
                onHandleQuickReplies={handleStartQuickReplies}
                onInboxZero={handleStartInboxZero}
              />
              <CategoryTabs
                active={activeCategoryTab}
                counts={gmailBuckets.counts}
                total={gmailBuckets.allVisible.length}
                locale={inboxLocale}
                onChange={handleCategoryTabChange}
              />
              {activeCategoryTab === "all" ? (
                <>
                  {gmailBuckets.counts.needs_attention === 0 &&
                  gmailBuckets.allVisible.length > 0 ? (
                    <section className="space-y-3">
                      <GmailCategorySectionHeader
                        category="needs_attention"
                        locale={uiLanguage}
                        count={0}
                      />
                      <InboxEmptyState
                        compact
                        tone="attention"
                        title={categoryEmptyMessage("needs_attention", inboxLocale)}
                        subtitle={completionCopy.subtitle}
                      />
                    </section>
                  ) : null}
                  {gmailBuckets.categoryOrder.map((category) => {
                    const list = gmailBuckets.byCategory[category];
                    if (!list.length) return null;
                    return (
                      <GmailCategorySection
                        key={category}
                        category={category}
                        list={list}
                        uiLanguage={uiLanguage}
                        count={gmailBuckets.counts[category]}
                        onSelectAll={() => handleSelectAllInSection(category)}
                        showContent={showContent}
                        selection={selection}
                        readStateMap={readStateMap}
                        onCategoryChange={handleCategoryChange}
                        onResetOverride={handleResetCategoryOverride}
                      />
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
                </>
              ) : (gmailBuckets.byCategory[activeCategoryTab] ?? []).length > 0 ? (
                <GmailCategorySection
                  category={activeCategoryTab}
                  list={gmailBuckets.byCategory[activeCategoryTab]}
                  uiLanguage={uiLanguage}
                  count={gmailBuckets.counts[activeCategoryTab]}
                  onSelectAll={() => handleSelectAllInSection(activeCategoryTab)}
                  showContent={showContent}
                  selection={selection}
                  readStateMap={readStateMap}
                  onCategoryChange={handleCategoryChange}
                  onResetOverride={handleResetCategoryOverride}
                />
              ) : (
                <InboxEmptyState
                  tone="calm"
                  title={categoryEmptyMessage(activeCategoryTab, inboxLocale)}
                />
              )}
              <InboxSecondaryTools
                messages={messagesWithOverrides as GmailCardMessage[]}
                gmailMessages={gmailMessages as GmailCardMessage[]}
                allVisible={gmailBuckets.allVisible as GmailCardMessage[]}
                locale={uiLanguage === "it" ? "it" : "en"}
                onCategoryChange={handleCategoryChange}
              />
              {nextPageToken ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-gray-600 transition hover:border-accent/40 hover:text-accent disabled:opacity-60"
                  >
                    {isLoadingMore
                      ? inboxLocale === "it"
                        ? "Caricamento…"
                        : "Loading…"
                      : inboxLocale === "it"
                        ? "Carica altre email"
                        : "Load more emails"}
                  </button>
                </div>
              ) : null}
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

      {undoToast ? (
        <CategoryUndoToast
          message={undoMessage}
          undoLabel={undoLabel}
          onUndo={() => void performUndo()}
          onDismiss={dismissUndoToast}
        />
      ) : null}

      {inboxMode === "gmail" && !undoToast ? (
        <BulkActionBar
          count={selection.count}
          totalVisible={gmailBuckets.allVisible.length}
          locale={inboxLocale}
          onMoveTo={handleBulkCategoryChange}
          onMarkHandled={handleBulkHandled}
          onArchive={handleBulkArchive}
          onDelete={handleBulkDelete}
          onMarkRead={handleBulkMarkRead}
          onMarkUnread={handleBulkMarkUnread}
          onSelectAllVisible={handleSelectAllVisible}
          onClear={selection.clear}
        />
      ) : null}

      {zeroSession ? (
        <InboxZeroMode
          steps={zeroSession.steps}
          mode={zeroSession.mode}
          locale={inboxLocale}
          onCompleteEmail={completeEmailInZero}
          onClearPromotions={clearPromotionsInZero}
          onFinished={handleZeroFinished}
          onClose={() => setZeroSession(null)}
        />
      ) : null}
    </main>
  );
}
