"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { InboxSectionTitle } from "@/lib/fake-emails";
import { ensureApiSessionCookies } from "@/lib/auth/ensure-api-session";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { saveGoogleProviderToken } from "@/lib/google-provider-token";
import { useCompletionWorkflow } from "@/app/completion-workflow-context";
import { useEmailCompletions } from "@/app/email-completions-context";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { InboxViewNav } from "@/app/emails/inbox-view-nav";
import { AuthNav } from "@/app/components/auth-nav";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import { inboxFetchHeaders, inboxLoadFetchHeaders } from "@/lib/inbox-fetch-headers";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import { loadClientSenderPreferences } from "@/lib/inbox-sender-preferences";
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
import { syncWorkflowModeFromAccount } from "@/lib/workflow-mode/client-sync";
import { InboxSourceSwitcher, type AccountFilterValue } from "@/app/emails/inbox-source-switcher";
import { AttachInboxButton } from "@/app/emails/attach-inbox-button";
import { InboxSearchBar } from "@/app/emails/inbox-search-bar";
import { InboxSearchResults } from "@/app/emails/inbox-search-results";
import { mergeInboxSearchResults } from "@/lib/inbox-search/merge";
import {
  INBOX_SEARCH_MIN_QUERY_LEN,
  type InboxSearchFilters,
  type InboxSearchMessage,
} from "@/lib/inbox-search/types";
import { InboxSecondaryTools } from "@/app/emails/inbox-secondary-tools";
import {
  isEmailCompleted,
  lookupScopedValue,
  scopedEmailKey,
} from "@/lib/gmail/account-types";
import type { ConnectedGmailAccount } from "@/lib/gmail/account-types";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";
import { InboxClutterSection } from "@/app/emails/inbox-clutter-section";
import { applyImportanceOrderingToBuckets } from "@/lib/importance-memory";
import { applyTimeImpactOrderingToBuckets } from "@/lib/time-impact/inbox-sort";
import { buildTimeStripGroups } from "@/lib/time-impact/time-strip";
import { classifyAutopilot } from "@/lib/autopilot";
import { isEmotionalInboxVisible } from "@/lib/emotional-memory";
import { useAutopilotProcessor } from "@/app/emails/use-autopilot-processor";
import { BetaAiFilterBar } from "@/app/emails/beta-ai-filter-bar";
import { InboxModeToggle } from "@/app/emails/inbox-mode-toggle";
import { InboxZeroFlowView } from "@/app/emails/inbox-zero-flow-view";
import { isBetaMode } from "@/lib/beta-mode";
import { applyBetaAiFilter, countBetaAiFilter, type BetaAiFilter } from "@/lib/beta-inbox/filter";
import { buildInboxZeroQueue } from "@/lib/inbox-zero/build-queue";
import {
  INBOX_INTERACTION_MODE_EVENT,
  readInboxInteractionMode,
  writeInboxInteractionMode,
  type InboxInteractionMode,
} from "@/lib/inbox-interaction-mode";
import { useStableInboxBuckets } from "@/app/emails/use-stable-inbox-buckets";
import { GmailInboxCard, type GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { InboxTimeStrip } from "@/app/emails/inbox-time-strip";
import { InboxSyncBar } from "@/app/emails/inbox-sync-bar";
import { CalmTypingIndicator } from "@/app/components/calm-loading";
import {
  calmSectionCountLabel,
  calmTodayHeadline,
  loadingRhythmMessages,
  pickFocusReassurance,
  type AttentionSnapshot,
} from "@/lib/attention-calm";
import { InboxEmptyState } from "@/app/emails/inbox-empty-state";
import {
  categoryEmptyMessage,
  inboxCompletionCopy,
  rotatingCompletionSeed,
} from "@/lib/empty-states";
import {
  classifyFetchError,
  classifyHttpStatus,
  inboxFailureNeedsConnectAccount,
  inboxFailureNeedsReconnect,
} from "@/lib/inbox-load/classify";
import {
  createInboxLoadId,
  elapsedMs,
  logInboxApiError,
  logInboxLoadComplete,
  logInboxLoadFailed,
  logInboxLoadStart,
  mergeTimings,
} from "@/lib/inbox-load/diagnostics";
import { handledErrorFromInboxFailure, type HandledError } from "@/lib/handled-errors";
import { inboxLoadUserMessage } from "@/lib/inbox-load/user-messages";
import type {
  InboxLoadApiErrorBody,
  InboxLoadFailureReason,
  InboxLoadStage,
  InboxLoadTimings,
} from "@/lib/inbox-load/types";
import { INBOX_AUTO_REFRESH_MS } from "@/lib/inbox-load/constants";
import {
  hasValidInboxCache,
  loadInboxCache,
  saveInboxCache,
  type InboxCacheSnapshot,
} from "@/lib/inbox-load/inbox-cache";
import { mergeInboxRefreshMessages } from "@/lib/inbox-load/merge-messages";
import {
  isInboxLoadBackoffActive,
  parseRetryAfterMs,
  recordInboxRateLimit,
  resetInboxRateLimitBackoff,
} from "@/lib/inbox-load/rate-limit-backoff";
import { INBOX_LOAD_CLIENT_TIMEOUT_MS } from "@/lib/inbox-load/types";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";
import { useInboxCategories } from "@/app/inbox-categories-context";
import {
  inboxCategorySubtitle,
  inboxCategoryTitle,
  type InboxAiCategory,
} from "@/lib/inbox-category-catalog";
import { type CategorySource, normalizeInboxAiCategory } from "@/lib/inbox-ai-categories";
import { saveClientPersonalCategories } from "@/lib/personal-categories/client-storage";
import { normalizePersonalCategoriesList } from "@/lib/personal-categories/storage";
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
  mergeReadStateFromGmail,
  READ_STATE_EVENT,
  type ReadStateMap,
} from "@/lib/read-state/client-storage";
import { useWaitingOnMetadata } from "@/app/waiting-on-metadata-context";
import { applyDoneInboxEffects } from "@/lib/client/inbox-truth/apply-done-effects";
import type { GmailTruthStats } from "@/lib/inbox-truth/types";
import { markEmailsRead, markEmailsUnread } from "@/lib/read-state/gmail-sync";
import {
  loadDismissedIds,
  addDismissedIds,
  removeDismissedIds,
  DISMISSED_EVENT,
} from "@/lib/dismissed/client-storage";
import { trackEvent } from "@/lib/analytics";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";
import { LanguageFooterToggle } from "@/app/components/language-footer-toggle";
import { GuidedOnboardingFlow } from "@/app/onboarding/guided-onboarding-flow";
import {
  FIRST_ONBOARDING_COMPLETE_EVENT,
  isFirstOnboardingComplete,
  markFirstOnboardingComplete,
} from "@/lib/onboarding/first-time";
import { useEmotionalMemoryLocale } from "@/app/hooks/use-emotional-memory";
import {
  EMOTIONAL_MEMORY_CHANGED_EVENT,
  getSavedInboxMode,
  readEmotionalMemory,
  resolveAdaptiveInboxSettings,
  savePreferredInboxMode,
} from "@/lib/emotional-memory";
import { TodaysFocusCard } from "@/app/emails/todays-focus-card";
import {
  INBOX_ZERO_STATE_COPY,
  inboxModeHint,
  inboxModeTitle,
} from "@/lib/inbox-modes";
import {
  InboxZeroMode,
  type InboxZeroRecategorizeMeta,
  type InboxZeroStep,
} from "@/app/emails/inbox-zero-mode";
import { useCategoryFeedback } from "@/app/hooks/use-category-feedback";
import { useMemoryCollect } from "@/app/hooks/use-memory-collect";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { CategoryTabs, type CategoryTab } from "@/app/emails/category-tabs";
import { calmLoadMoreMessage } from "@/lib/calm-system-copy";
import { WaitingOnInboxSection } from "@/app/emails/waiting-on-inbox-section";
import { workflowFieldsFromCompletion } from "@/lib/email-workflow-state";
import { CategoryViewGuidance } from "@/app/emails/category-view-guidance";
import {
  consumeInboxScrollRestore,
  inboxEmailAnchorId,
  scrollToInboxEmail,
} from "@/lib/inbox-return-context";

type GmailInboxMessage = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  internalDateMs?: number;
  labelIds?: string[];
  waitingResponseUpdate?: boolean;
  category: InboxAiCategory;
  categoryConfidence?: number;
  categorySource?: CategorySource;
  hasUnsubscribeSignal?: boolean;
  needsCalendarContext?: boolean;
  actionIntelligence?: import("@/lib/action-intelligence").ActionIntelligenceSummary;
  timeImpact?: import("@/lib/time-impact").TimeImpactResult;
  autopilot?: import("@/lib/autopilot").AutopilotSummary;
  timelineIntelligence?: import("@/lib/timeline-intelligence").TimelineIntelligenceSummary;
  relationship?: SenderRelationshipProfile;
  accountId?: string;
  accountEmail?: string;
  accountLabel?: string;
};

type InboxMode =
  | "loading"
  | "gmail"
  | "gmail_empty"
  | "no_google"
  | "gmail_error";

const CATEGORY_TAB_KEY = "handled_category_tab_v1";
const ACCOUNT_FILTER_KEY = "handled_account_filter_v1";

function loadAccountFilter(): AccountFilterValue {
  if (typeof window === "undefined") return "all";
  try {
    const raw = localStorage.getItem(ACCOUNT_FILTER_KEY);
    if (raw === "all" || (raw && raw.length > 0)) return raw;
  } catch {
    /* ignore */
  }
  return "all";
}

function saveAccountFilter(value: AccountFilterValue): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCOUNT_FILTER_KEY, value);
  } catch {
    /* ignore */
  }
}

function loadCategoryTab(validIds: ReadonlySet<string>): CategoryTab {
  if (typeof window === "undefined") return "all";
  try {
    const raw = localStorage.getItem(CATEGORY_TAB_KEY);
    if (raw && (raw === "all" || validIds.has(raw))) return raw as CategoryTab;
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

function formatInboxDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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
  const { catalog } = useInboxCategories();
  const subtitle = inboxModeHint(category, locale) ?? inboxCategorySubtitle(category, locale, catalog);
  const isPrimary =
    category === "worth_your_attention" ||
    category === "good_to_know" ||
    catalog.personalIds.includes(category);

  return (
    <div className="group/section flex flex-wrap items-baseline justify-between gap-2 pb-2 pt-4">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-gray-600">
            {inboxModeTitle(category, locale, catalog)}
          </h2>
          {subtitle && isPrimary ? (
            <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
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
  activeCategoryTab,
  showAccountBadges,
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
  activeCategoryTab: CategoryTab;
  showAccountBadges: boolean;
}) {
  return (
    <section className="space-y-1">
      <GmailCategorySectionHeader
        category={category}
        locale={uiLanguage}
        count={count}
        onSelectAll={onSelectAll}
      />
      <div>
        {list.map((message) => (
          <div
            key={message.id}
            id={inboxEmailAnchorId(message.id)}
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
              readStateMap={readStateMap}
              inboxReturnCapture={{ view: "inbox", categoryTab: activeCategoryTab }}
              showAccountBadge={showAccountBadges}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function EmailCardSkeleton() {
  return (
    <div className="border-b border-gray-100/90 py-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-16 rounded subtle-shimmer" />
          <div className="h-3 w-12 rounded subtle-shimmer" />
        </div>
        <div className="h-4 w-32 rounded subtle-shimmer" />
        <div className="h-5 w-3/4 rounded subtle-shimmer" />
        <div className="h-4 w-full rounded subtle-shimmer" />
        <div className="h-8 w-24 rounded-lg subtle-shimmer" />
      </div>
    </div>
  );
}

export function EmailsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ui = useUiCopy();
  const { catalog } = useInboxCategories();
  const validTabIds = useMemo(
    () => new Set<string>(["all", ...catalog.allIds]),
    [catalog],
  );
  const { notifyCompleted } = useCompletionWorkflow();
  const { uiLanguage } = useUserPreferences();
  const loadingMicroMessages = useMemo(
    () => loadingRhythmMessages(uiLanguage === "it" ? "it" : "en"),
    [uiLanguage],
  );
  const {
    completions,
    completeEmails,
    scanWaitingResponses,
    waitingResponseRecords,
    waitingOpenRecords,
    isCompleted,
  } = useEmailCompletions();
  const { submitCategoryFeedback } = useCategoryFeedback();
  const { collectUserOverrideLog } = useMemoryCollect();

  const [inboxMode, setInboxMode] = useState<InboxMode>("loading");
  const [gmailMessages, setGmailMessages] = useState<GmailInboxMessage[]>([]);
  // Stable handle for callbacks that need to resolve a message's accountId
  // without re-creating on every message change.
  const gmailMessagesRef = useRef<GmailInboxMessage[]>([]);
  gmailMessagesRef.current = gmailMessages;
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, InboxAiCategory>>(
    {},
  );
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [emotionalMemoryRevision, setEmotionalMemoryRevision] = useState(0);
  useEffect(() => {
    const sync = () => setEmotionalMemoryRevision((n) => n + 1);
    window.addEventListener(EMOTIONAL_MEMORY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(EMOTIONAL_MEMORY_CHANGED_EVENT, sync);
  }, []);
  const adaptiveSettings = useMemo(
    () => resolveAdaptiveInboxSettings(readEmotionalMemory()),
    [emotionalMemoryRevision],
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [workflowMode, setWorkflowMode] = useState(readWorkflowModeFromStorage);
  const [gmailError, setGmailError] = useState("");
  const [inboxFailureReason, setInboxFailureReason] = useState<InboxLoadFailureReason | null>(null);
  const [structuredInboxError, setStructuredInboxError] = useState<HandledError | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [gmailTruth, setGmailTruth] = useState<GmailTruthStats | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedGmailAccount[]>([]);
  const [activeAccountFilter, setActiveAccountFilter] = useState<AccountFilterValue>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Pagination plumbing (Gmail nextPageToken). UI only exposes a manual
  // "load more" for now — no infinite scroll yet.
  const nextPageTokenRef = useRef<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  nextPageTokenRef.current = nextPageToken;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showMicroMessage, setShowMicroMessage] = useState(true);
  const [rateLimitNotice, setRateLimitNotice] = useState("");
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const loadInFlightRef = useRef(false);
  const pendingSilentRefreshRef = useRef(false);
  const hasLoadedInboxRef = useRef(false);

  const applyInboxCacheSnapshot = useCallback((cache: InboxCacheSnapshot): boolean => {
    if (!cache.gmailMessages.length) return false;
    setGmailMessages(cache.gmailMessages as GmailInboxMessage[]);
    setCategoryOverrides(cache.categoryOverrides as Record<string, InboxAiCategory>);
    setNextPageToken(cache.nextPageToken);
    if (cache.gmailTruth) setGmailTruth(cache.gmailTruth);
    if (cache.lastSyncedAt) setLastSyncedAt(cache.lastSyncedAt);
    setGmailError("");
    setInboxFailureReason(null);
    setStructuredInboxError(null);
    setInboxMode("gmail");
    return true;
  }, []);

  const showCachedInboxOnRateLimit = useCallback(
    (locale: "en" | "it"): boolean => {
      const cache = loadInboxCache();
      if (!cache?.gmailMessages.length) return false;
      applyInboxCacheSnapshot(cache);
      setRateLimitNotice(inboxLoadUserMessage("rate_limit_soft", locale));
      return true;
    },
    [applyInboxCacheSnapshot],
  );

  const loadInbox = useCallback(
    async (options?: {
      silent?: boolean;
      pageToken?: string | null;
      append?: boolean;
      refresh?: boolean;
      force?: boolean;
    }) => {
      const append = Boolean(options?.append);
      const paginated = Boolean(options?.pageToken);
      const refresh =
        Boolean(options?.refresh) ||
        (Boolean(options?.silent) && hasLoadedInboxRef.current && !paginated && !append);
      const locale = uiLanguage === "it" ? "it" : "en";
      const loadId = createInboxLoadId();
      const loadStarted = Date.now();

      if (loadInFlightRef.current) {
        if (options?.silent) pendingSilentRefreshRef.current = true;
        return;
      }

      if (
        !options?.force &&
        !paginated &&
        isInboxLoadBackoffActive() &&
        (options?.silent || refresh)
      ) {
        return;
      }

      loadInFlightRef.current = true;

      logInboxLoadStart({
        loadId,
        paginated,
        pageToken: options?.pageToken ?? null,
        append,
        refresh,
      });

      if (!options?.silent && !append && !hasValidInboxCache()) {
        setInboxMode("loading");
      }
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsRefreshing(true);
      }
      setGmailError("");
    setInboxFailureReason(null);
    setStructuredInboxError(null);

      const sessionStarted = Date.now();
      const hasSession = await ensureApiSessionCookies();
      let clientTimings: InboxLoadTimings = { clientSessionMs: elapsedMs(sessionStarted) };

      try {
        if (!hasSession) {
          router.replace(`/login?next=${encodeURIComponent("/emails")}`);
          return;
        }

        const params = new URLSearchParams();
        if (options?.pageToken) {
          params.set("pageToken", options.pageToken);
        } else if (refresh) {
          params.set("refresh", "1");
        }
        if (activeAccountFilter !== "all") {
          params.set("accountId", activeAccountFilter);
        }
        const url = params.toString()
          ? `/api/gmail/messages?${params.toString()}`
          : "/api/gmail/messages";

        const fetchStarted = Date.now();
        const res = await fetch(url, {
          credentials: "include",
          headers: await inboxLoadFetchHeaders(),
          signal: AbortSignal.timeout(INBOX_LOAD_CLIENT_TIMEOUT_MS),
        });
        clientTimings = mergeTimings(clientTimings, {
          clientFetchMs: elapsedMs(fetchStarted),
        });

        let body: InboxLoadApiErrorBody & {
          messages?: GmailInboxMessage[];
          categoryOverrides?: Record<string, InboxAiCategory>;
          emailOverrideRecords?: EmailCategoryOverride[];
          personalCategories?: import("@/lib/personal-categories/types").PersonalInboxCategory[];
          nextPageToken?: string | null;
          refresh?: boolean;
          gmailTruth?: GmailTruthStats | null;
          accounts?: ConnectedGmailAccount[];
          diagnostics?: InboxLoadApiErrorBody["diagnostics"];
          code?: string;
          category?: HandledError["category"];
          userMessage?: string;
          actionLabel?: string;
          action?: HandledError["action"];
          title?: string;
        };

        const applyStructuredFailure = (
          failureReason: InboxLoadFailureReason,
          apiBody?: typeof body,
          userMessage?: string,
        ) => {
          const structured =
            apiBody?.userMessage && apiBody?.action
              ? ({
                  code: apiBody.code ?? failureReason,
                  category: apiBody.category ?? "server",
                  userMessage: apiBody.userMessage,
                  actionLabel: apiBody.actionLabel ?? "Try again",
                  action: apiBody.action ?? "retry",
                  title: apiBody.title,
                } as HandledError)
              : handledErrorFromInboxFailure(failureReason, locale);
          setInboxFailureReason(failureReason);
          setStructuredInboxError(structured);
          setGmailError(userMessage ?? structured.userMessage);
          return structured;
        };

        try {
          body = (await res.json()) as typeof body;
        } catch (parseError) {
          const failureReason: InboxLoadFailureReason =
            res.status === 431 ? "headers_too_large" : "server_unavailable";
          applyStructuredFailure(failureReason);
          logInboxApiError({
            endpoint: url,
            httpStatus: res.status,
            accountId: activeAccountFilter !== "all" ? activeAccountFilter : null,
            failureReason,
            failureStage: "client_fetch",
            loadId,
            errorBody: { parseError: String(parseError) },
            cause: parseError,
          });
          logInboxLoadFailed({
            loadId,
            startedAt: loadStarted,
            paginated,
            pageToken: options?.pageToken ?? null,
            append,
            refresh,
            failureReason,
            failureStage: "client_fetch",
            timings: mergeTimings(clientTimings, { totalMs: elapsedMs(loadStarted) }),
          });
          if (!append) {
            setInboxMode("gmail_error");
          }
          return;
        }

        const applyInboxFailure = (
          failureReason: InboxLoadFailureReason,
          failureStage: InboxLoadStage,
          userMessage: string,
        ) => {
          applyStructuredFailure(failureReason, body, userMessage);
          logInboxApiError({
            endpoint: url,
            httpStatus: res.status,
            accountId: activeAccountFilter !== "all" ? activeAccountFilter : null,
            failureReason,
            failureStage,
            loadId,
            errorBody: body,
          });

          if (inboxFailureNeedsConnectAccount(failureReason)) {
            setInboxMode("no_google");
            return;
          }

          if (!append) {
            setInboxMode("gmail_error");
          } else {
            console.warn("[inbox-load] load-more failed", {
              loadId,
              failureReason,
              failureStage,
            });
          }
        };

        if (!res.ok) {
          const failureReason = classifyHttpStatus(res.status, body);
          const failureStage = (body.failureStage ?? "client_fetch") as InboxLoadStage;
          const userMessage =
            typeof body.message === "string"
              ? body.message
              : inboxLoadUserMessage(failureReason, locale);

          const isRateLimit =
            failureReason === "gmail_rate_limit" || res.status === 429;

          if (isRateLimit) {
            const retryAfterMs =
              body.retryAfterMs ??
              body.diagnostics?.retryAfterMs ??
              parseRetryAfterMs(res.status, body.message ?? "");
            const backoff = recordInboxRateLimit({
              retryAfterMs,
              source: "client_fetch",
            });

            logInboxLoadFailed({
              loadId,
              startedAt: loadStarted,
              paginated,
              pageToken: options?.pageToken ?? null,
              append,
              refresh,
              failureReason: "gmail_rate_limit",
              failureStage,
              gmailStatus: body.gmailStatus ?? res.status,
              gmailReason: body.gmailReason ?? null,
              retryAfterMs: backoff.lastRetryAfterMs,
              backoffDelayMs: backoff.lastBackoffDelayMs,
              consecutive429Count: backoff.consecutive429Count,
              timings: mergeTimings(clientTimings, body.diagnostics?.timings, {
                totalMs: elapsedMs(loadStarted),
              }),
            });

            if (!append && showCachedInboxOnRateLimit(locale)) {
              return;
            }
          } else {
            logInboxLoadFailed({
              loadId,
              startedAt: loadStarted,
              paginated,
              pageToken: options?.pageToken ?? null,
              append,
              refresh,
              failureReason,
              failureStage,
              gmailStatus: body.gmailStatus ?? res.status,
              gmailReason: body.gmailReason ?? null,
              timings: mergeTimings(clientTimings, body.diagnostics?.timings, {
                totalMs: elapsedMs(loadStarted),
              }),
            });
          }

          applyInboxFailure(failureReason, failureStage, userMessage);
          return;
        }

        resetInboxRateLimitBackoff();
        setRateLimitNotice("");

        if (body.personalCategories?.length) {
          saveClientPersonalCategories(
            normalizePersonalCategoriesList(body.personalCategories),
          );
          window.dispatchEvent(new Event("handled-personal-categories-changed"));
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
            labelIds: Array.isArray((r as { labelIds?: string[] }).labelIds)
              ? (r as { labelIds: string[] }).labelIds
              : undefined,
            category: normalizeInboxAiCategory(
              typeof r.category === "string" ? r.category : "worth_your_attention",
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
            timeImpact: (r as { timeImpact?: GmailCardMessage["timeImpact"] }).timeImpact,
            autopilot: (r as { autopilot?: GmailCardMessage["autopilot"] }).autopilot,
            timelineIntelligence: (
              r as { timelineIntelligence?: GmailCardMessage["timelineIntelligence"] }
            ).timelineIntelligence,
            relationship:
              (r as { relationship?: SenderRelationshipProfile }).relationship ?? undefined,
            accountId: (r as { accountId?: string }).accountId,
            accountEmail: (r as { accountEmail?: string }).accountEmail,
            accountLabel: (r as { accountLabel?: string }).accountLabel,
          };
        });
        if (body.accounts?.length) {
          setConnectedAccounts(body.accounts);
        }
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
        mergeReadStateFromGmail(stampedMsgs);
        const syncedAt = new Date().toISOString();
        if (body.gmailTruth) {
          setGmailTruth(body.gmailTruth);
        }
        const cachedGmailTruth = body.gmailTruth ?? undefined;

        if (append) {
          setGmailMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const additions = stampedMsgs.filter((m) => !seen.has(m.id));
            const merged = [...prev, ...additions];
            saveInboxCache({
              savedAt: Date.now(),
              gmailMessages: merged,
              categoryOverrides: mergedOverrideMap,
              nextPageToken: body.nextPageToken ?? null,
              lastSyncedAt: syncedAt,
              gmailTruth: cachedGmailTruth,
            });
            return merged;
          });
          setNextPageToken(body.nextPageToken ?? null);
        } else if (refresh) {
          setGmailMessages((prev) => {
            const merged = mergeInboxRefreshMessages(prev, stampedMsgs);
            saveInboxCache({
              savedAt: Date.now(),
              gmailMessages: merged,
              categoryOverrides: mergedOverrideMap,
              nextPageToken: nextPageTokenRef.current,
              lastSyncedAt: syncedAt,
              gmailTruth: cachedGmailTruth,
            });
            return merged;
          });
        } else {
          setGmailMessages(stampedMsgs);
          setNextPageToken(body.nextPageToken ?? null);
          saveInboxCache({
            savedAt: Date.now(),
            gmailMessages: stampedMsgs,
            categoryOverrides: mergedOverrideMap,
            nextPageToken: body.nextPageToken ?? null,
            lastSyncedAt: syncedAt,
            gmailTruth: cachedGmailTruth,
          });
        }

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
          setInboxMode(msgs.length || refresh ? "gmail" : "gmail_empty");
        }
        setLastSyncedAt(syncedAt);
        hasLoadedInboxRef.current = true;

        const serverDiag = body.diagnostics;
        const timings = mergeTimings(clientTimings, serverDiag?.timings, {
          totalMs: elapsedMs(loadStarted),
        });
        logInboxLoadComplete({
          loadId,
          startedAt: loadStarted,
          paginated,
          pageToken: options?.pageToken ?? null,
          append,
          refresh,
          emailCount: msgs.length,
          timings,
          slow: (timings.totalMs ?? 0) >= 5000,
        });
      } catch (e) {
        const failureReason = classifyFetchError(e);
        const structured = handledErrorFromInboxFailure(failureReason, locale);
        setInboxFailureReason(failureReason);
        setStructuredInboxError(structured);
        setGmailError(structured.userMessage);
        const accountIdForLog = activeAccountFilter !== "all" ? activeAccountFilter : null;

        logInboxApiError({
          endpoint: "/api/gmail/messages",
          httpStatus: 0,
          accountId: accountIdForLog,
          failureReason,
          failureStage: "client_fetch",
          loadId,
          cause: e,
        });

        logInboxLoadFailed({
          loadId,
          startedAt: loadStarted,
          paginated,
          pageToken: options?.pageToken ?? null,
          append,
          refresh,
          failureReason,
          failureStage: "client_fetch",
          timings: mergeTimings(clientTimings, { totalMs: elapsedMs(loadStarted) }),
        });

        if (!append) {
          setInboxMode("gmail_error");
        }
      } finally {
        loadInFlightRef.current = false;
        setIsRefreshing(false);
        setIsLoadingMore(false);

        if (pendingSilentRefreshRef.current && !isInboxLoadBackoffActive()) {
          pendingSilentRefreshRef.current = false;
          void loadInbox({ silent: true, refresh: true });
        }
      }
    },
    [router, showCachedInboxOnRateLimit, uiLanguage, activeAccountFilter],
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
      setUserEmail(session?.user?.email ?? null);
      const [mode, overrides, senderPrefs] = await Promise.all([
        syncWorkflowModeFromAccount(),
        session ? syncEmailOverridesFromAccount() : Promise.resolve(loadClientEmailOverrideMap()),
        session ? syncSenderRelationshipsFromAccount() : Promise.resolve([]),
        session ? syncSenderPreferencesFromAccount() : Promise.resolve(loadClientSenderPreferences()),
      ]);
      if (cancelled) return;
      setWorkflowMode(mode);
      setCategoryOverrides(overrides);
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
    const cache = loadInboxCache();
    const hasCache = Boolean(cache?.gmailMessages.length);
    if (hasCache && cache) {
      applyInboxCacheSnapshot(cache);
      hasLoadedInboxRef.current = true;
    }
    void loadInbox(hasCache ? { silent: true } : undefined);
  }, [applyInboxCacheSnapshot, loadInbox, persistenceReady]);

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
      setCategoryOverrides((prev) => ({ ...prev, ...overrides }));
    };
    const onSenderPrefsChange = async () => {
      await syncSenderPreferencesFromAccount();
      void loadInbox();
    };
    window.addEventListener("handled-workflow-mode-changed", onModeChange);
    window.addEventListener("handled-inbox-rules-changed", onRulesChange);
    window.addEventListener("handled-inbox-refresh-requested", onRulesChange);
    window.addEventListener("handled-sender-preferences-changed", onSenderPrefsChange);
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
      if (isInboxLoadBackoffActive()) return;
      void loadInbox({ silent: true, refresh: true });
    }, INBOX_AUTO_REFRESH_MS);
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

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const sync = () => setDismissedIds(loadDismissedIds());
    sync();
    window.addEventListener(DISMISSED_EVENT, sync);
    return () => window.removeEventListener(DISMISSED_EVENT, sync);
  }, []);

  // Dismissed entries are account-scoped (`accountId:emailId`) with legacy
  // raw-id entries still honored.
  const isDismissedMessage = useCallback(
    (m: { id: string; accountId?: string }) =>
      dismissedIds.has(scopedEmailKey(m.id, m.accountId)) || dismissedIds.has(m.id),
    [dismissedIds],
  );

  const messagesWithOverrides = useMemo(() => {
    const visible =
      dismissedIds.size === 0
        ? gmailMessages
        : gmailMessages.filter((m) => !isDismissedMessage(m));
    return visible.filter((m) => !isEmailCompleted(m, completions));
  }, [gmailMessages, dismissedIds, isDismissedMessage, completions]);

  useEffect(() => {
    if (inboxMode !== "gmail" || gmailMessages.length === 0) return;
    const visible =
      dismissedIds.size === 0
        ? gmailMessages
        : gmailMessages.filter((m) => !isDismissedMessage(m));
    void scanWaitingResponses(
      visible.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        sender: m.sender,
        subject: m.subject,
        snippet: m.snippet,
        internalDateMs: m.internalDateMs,
        date: m.date,
      })),
      { userEmail },
    );
  }, [inboxMode, gmailMessages, dismissedIds, isDismissedMessage, scanWaitingResponses, userEmail]);

  const messagesForDisplay = useMemo(() => {
    const responseEmailIds = new Set(
      waitingResponseRecords
        .map((r) => r.waitingResponseEmailId)
        .filter((id): id is string => Boolean(id)),
    );
    return messagesWithOverrides.map((m) => {
      const completion = lookupScopedValue(completions, m.id, m.accountId);
      const workflow = workflowFieldsFromCompletion(completion);
      const base = responseEmailIds.has(m.id)
        ? { ...m, waitingResponseUpdate: true }
        : m;

      const withWorkflow = { ...base, ...workflow };

      const autopilot =
        withWorkflow.autopilot ??
        classifyAutopilot({
          row: withWorkflow,
          category: withWorkflow.category,
          categoryConfidence: withWorkflow.categoryConfidence,
          categorySource: withWorkflow.categorySource,
          actionState: withWorkflow.actionIntelligence?.actionState,
          primaryLabel: withWorkflow.actionIntelligence?.primaryLabel,
          timeImpactKind: withWorkflow.timeImpact?.kind,
          waitingResponseUpdate: withWorkflow.waitingResponseUpdate,
        });

      return { ...withWorkflow, autopilot };
    });
  }, [messagesWithOverrides, waitingResponseRecords, completions]);

  /** Autopilot inbox: Level 3 + 4 only. Level 1/2 never appear. */
  const messagesForInbox = useMemo(
    () =>
      messagesForDisplay.filter((m) =>
        isEmotionalInboxVisible(
          m.autopilot,
          adaptiveSettings.aggressiveAutopilotFilter,
        ),
      ),
    [messagesForDisplay, adaptiveSettings.aggressiveAutopilotFilter],
  );

  /** Tab buckets always include every loaded message — autopilot only trims workflow sections. */
  const inboxBucketMessages = useMemo(
    () => messagesForDisplay as GmailCardMessage[],
    [messagesForDisplay],
  );

  const inboxLocaleEarly = uiLanguage === "it" ? "it" : "en";
  useAutopilotProcessor(
    messagesForDisplay as GmailInboxMessage[],
    inboxLocaleEarly,
    inboxMode === "gmail",
  );

  /** All loaded messages for search — includes completed; bypasses workflow visibility. */
  const messagesForSearchPool = useMemo(() => {
    if (dismissedIds.size === 0) return gmailMessages;
    return gmailMessages.filter((m) => !isDismissedMessage(m));
  }, [gmailMessages, dismissedIds, isDismissedMessage]);

  const { buckets: gmailBucketsRaw, isCountsPending } = useStableInboxBuckets({
    messages: inboxBucketMessages,
    workflowMode,
    isRefreshing,
    isInitialLoading: inboxMode === "loading",
    catalog,
  });

  const gmailBuckets = useMemo(
    () =>
      applyTimeImpactOrderingToBuckets(
        applyImportanceOrderingToBuckets(gmailBucketsRaw, completions),
      ),
    [gmailBucketsRaw, completions],
  );

  const { summary: waitingSummary } = useWaitingOnMetadata();

  const betaMode = isBetaMode();
  const [betaAiFilter, setBetaAiFilter] = useState<BetaAiFilter>("all");
  const [inboxInteractionMode, setInboxInteractionMode] = useState<InboxInteractionMode>("standard");

  useEffect(() => {
    const sessionMode = readInboxInteractionMode();
    if (sessionMode === "standard") {
      const saved = getSavedInboxMode();
      if (saved && saved !== "standard") {
        writeInboxInteractionMode(saved);
        setInboxInteractionMode(saved);
      } else {
        setInboxInteractionMode(sessionMode);
      }
    } else {
      setInboxInteractionMode(sessionMode);
    }
    const sync = () => setInboxInteractionMode(readInboxInteractionMode());
    window.addEventListener(INBOX_INTERACTION_MODE_EVENT, sync);
    return () => window.removeEventListener(INBOX_INTERACTION_MODE_EVENT, sync);
  }, []);

  const handleInboxInteractionModeChange = useCallback((mode: InboxInteractionMode) => {
    setInboxInteractionMode(mode);
    writeInboxInteractionMode(mode);
    savePreferredInboxMode(mode);
    if (mode === "inbox_zero") {
      trackEvent("inbox_zero_mode_enabled");
    } else {
      trackEvent("inbox_zero_mode_exited");
    }
  }, []);

  const [firstOnboardingDone, setFirstOnboardingDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return isFirstOnboardingComplete();
  });
  useEffect(() => {
    const sync = () => setFirstOnboardingDone(isFirstOnboardingComplete());
    window.addEventListener(FIRST_ONBOARDING_COMPLETE_EVENT, sync);
    return () => window.removeEventListener(FIRST_ONBOARDING_COMPLETE_EVENT, sync);
  }, []);

  const firstOnboardingPending = !firstOnboardingDone;
  const showGuidedOnboarding = firstOnboardingPending;

  const onboardingAdaptive = adaptiveSettings;

  const emotionalMemory = useEmotionalMemoryLocale(inboxLocaleEarly, {
    inboxVolume: gmailBuckets.allVisible.length,
    enabled: !showGuidedOnboarding && inboxMode === "gmail",
  });

  const handleFirstOnboardingFinished = useCallback(() => {
    markFirstOnboardingComplete();
    setFirstOnboardingDone(true);
    trackEvent("guided_onboarding_completed");
  }, []);

  const fetchOnboardingExamples = useCallback(async () => {
    const params = new URLSearchParams({ onboarding: "1" });
    if (activeAccountFilter !== "all") {
      params.set("accountId", activeAccountFilter);
    }
    const res = await fetch(`/api/gmail/messages?${params.toString()}`, {
      credentials: "include",
      headers: await inboxLoadFetchHeaders(),
      signal: AbortSignal.timeout(INBOX_LOAD_CLIENT_TIMEOUT_MS),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { messages?: GmailInboxMessage[] };
    if (!body.messages?.length) return;
    setGmailMessages((prev) => {
      const merged = new Map(
        prev.map((m) => [scopedEmailKey(m.id, m.accountId), m] as const),
      );
      for (const message of body.messages ?? []) {
        merged.set(scopedEmailKey(message.id, message.accountId), message);
      }
      return [...merged.values()].sort(
        (a, b) => (b.internalDateMs ?? 0) - (a.internalDateMs ?? 0),
      );
    });
  }, [activeAccountFilter]);

  const betaAiFilterCounts = useMemo(
    () => countBetaAiFilter(gmailBuckets.allVisible as GmailCardMessage[]),
    [gmailBuckets.allVisible],
  );

  const filterInboxList = useCallback(
    (list: GmailCardMessage[], options?: { categoryTabOnly?: boolean }) =>
      betaMode && !options?.categoryTabOnly ? applyBetaAiFilter(list, betaAiFilter) : list,
    [betaMode, betaAiFilter],
  );

  /** All-tab workflow sections hide autopilot-auto; category tabs show every message. */
  const filterWorkflowSection = useCallback(
    (list: GmailCardMessage[]) => {
      const filtered = filterInboxList(list);
      const aggressive = adaptiveSettings.aggressiveAutopilotFilter;
      return betaMode
        ? filtered
        : filtered.filter((m) =>
            isEmotionalInboxVisible(m.autopilot, aggressive),
          );
    },
    [filterInboxList, betaMode, adaptiveSettings.aggressiveAutopilotFilter],
  );

  const betaFilterActive = betaMode && betaAiFilter !== "all";

  const focusEmails = useMemo(() => {
    const pool = gmailBuckets.byCategoryAll.worth_your_attention ?? [];
    const count = showGuidedOnboarding ? 3 : adaptiveSettings.focusPreviewCount;
    return pool.slice(0, count).map((m) => ({
      id: m.id,
      sender: m.sender,
      subject: m.subject,
      snippet: m.snippet,
      accountId: m.accountId,
    }));
  }, [gmailBuckets.byCategoryAll, showGuidedOnboarding, adaptiveSettings.focusPreviewCount]);

  const focusAttentionCount = gmailBuckets.counts.worth_your_attention ?? 0;

  const handledElsewhereCount = Math.max(
    0,
    messagesForDisplay.length - focusEmails.length,
  );

  const inboxLocale = uiLanguage === "it" ? "it" : "en";

  const timeStripGroups = useMemo(
    () =>
      buildTimeStripGroups(
        messagesForInbox.map((m) => ({
          id: m.id,
          sender: m.sender,
          subject: m.subject,
          timeImpact: m.timeImpact,
          accountId: m.accountId,
        })),
        inboxLocale,
      ),
    [messagesForInbox, inboxLocale],
  );

  const autopilotWorkflowClear =
    !isBetaMode() &&
    inboxMode === "gmail" &&
    messagesForInbox.length === 0 &&
    messagesForDisplay.length > 0;

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

  const [activeCategoryTab, setActiveCategoryTab] = useState<CategoryTab>("all");

  const inboxZeroQueue = useMemo(
    () =>
      inboxInteractionMode === "inbox_zero"
        ? buildInboxZeroQueue(
            activeCategoryTab,
            gmailBuckets,
            (list) =>
              activeCategoryTab === "all"
                ? filterWorkflowSection(list)
                : filterInboxList(list, { categoryTabOnly: true }),
            isCompleted,
          )
        : [],
    [
      inboxInteractionMode,
      activeCategoryTab,
      gmailBuckets,
      filterInboxList,
      isCompleted,
      completions,
    ],
  );

  const [searchFilters, setSearchFilters] = useState<InboxSearchFilters>({
    query: "",
    category: "all",
    accountId: "all",
    read: "all",
  });
  const [searchGmailResults, setSearchGmailResults] = useState<InboxSearchMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isSearchActive =
    searchFilters.query.trim().length >= INBOX_SEARCH_MIN_QUERY_LEN;

  const searchResultSet = useMemo(() => {
    if (!isSearchActive) {
      return { inbox: [] as InboxSearchMessage[], completedOnly: [] };
    }
    return mergeInboxSearchResults({
      gmailResults: searchGmailResults,
      loadedMessages: messagesForSearchPool as InboxSearchMessage[],
      completions,
      filters: searchFilters,
      readMap: readStateMap,
    });
  }, [
    isSearchActive,
    searchGmailResults,
    messagesForSearchPool,
    completions,
    searchFilters,
    readStateMap,
  ]);

  useEffect(() => {
    const q = searchFilters.query.trim();
    if (q.length < INBOX_SEARCH_MIN_QUERY_LEN) {
      setSearchGmailResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        setSearchError(null);
        try {
          const params = new URLSearchParams({ q });
          if (searchFilters.read !== "all") {
            params.set("read", searchFilters.read);
          }
          const res = await fetch(`/api/gmail/search?${params.toString()}`, {
            credentials: "include",
            headers: await inboxLoadFetchHeaders(),
            signal: controller.signal,
          });
          const body = (await res.json()) as {
            messages?: InboxSearchMessage[];
            userMessage?: string;
          };
          if (!res.ok) {
            setSearchGmailResults([]);
            setSearchError(
              body.userMessage ??
                (inboxLocale === "it"
                  ? "Gmail non ha completato la ricerca — riprova."
                  : "Gmail couldn't complete your search — try again."),
            );
            return;
          }
          setSearchGmailResults(body.messages ?? []);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("[inbox search]", error);
          }
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchFilters.query, searchFilters.read]);

  useEffect(() => {
    void supabaseBrowser.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session?.user));
    });
    const { data } = supabaseBrowser.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (searchParams.get("inbox_added") === "1") {
      setAttachNotice(
        inboxLocale === "it"
          ? "Inbox collegata — compare nella tua inbox unificata."
          : "Inbox attached — it will appear in your unified inbox.",
      );
      void loadInbox({ refresh: true, force: true });
      window.history.replaceState(null, "", "/emails");
    }
    const attachError = searchParams.get("attach_error");
    if (attachError) {
      setAttachNotice(
        inboxLocale === "it"
          ? `Impossibile allegare l'inbox: ${decodeURIComponent(attachError)}`
          : `Could not attach inbox: ${decodeURIComponent(attachError)}`,
      );
      window.history.replaceState(null, "", "/emails");
    }
  }, [searchParams, inboxLocale, loadInbox]);

  useEffect(() => {
    setActiveCategoryTab(loadCategoryTab(validTabIds));
    setActiveAccountFilter(loadAccountFilter());
  }, [validTabIds]);

  const handleAccountFilterChange = useCallback((value: AccountFilterValue) => {
    setActiveAccountFilter(value);
    saveAccountFilter(value);
    void loadInbox({ refresh: true, force: true });
  }, [loadInbox]);

  const handleCategoryTabChange = useCallback((tab: CategoryTab) => {
    setActiveCategoryTab(tab);
    saveCategoryTab(tab);
  }, []);

  useEffect(() => {
    if (inboxLoading || !showContent || inboxMode !== "gmail") return;

    const restore = consumeInboxScrollRestore();
    if (!restore || restore.view !== "inbox") return;

    if (restore.categoryTab && validTabIds.has(restore.categoryTab)) {
      setActiveCategoryTab(restore.categoryTab as CategoryTab);
      saveCategoryTab(restore.categoryTab as CategoryTab);
    }

    const timer = window.setTimeout(() => {
      scrollToInboxEmail(restore.anchorEmailId, restore.scrollY);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [inboxLoading, showContent, inboxMode, validTabIds]);

  // Core move: persist overrides + update UI for a set of ids. No undo/toast.
  // Override keys are account-scoped (`accountId:emailId`) — Gmail ids are
  // only unique within one mailbox.
  const applyCategoryToIds = useCallback(
    (ids: string[], category: InboxAiCategory) => {
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      const accountById = new Map(
        gmailMessagesRef.current.map((m) => [m.id, m.accountId] as const),
      );
      const keyFor = (id: string) => scopedEmailKey(id, accountById.get(id));

      for (const id of ids) {
        upsertClientEmailOverride({
          emailId: keyFor(id),
          originalCategory: null,
          overriddenCategory: category,
          createdAt: now,
          updatedAt: now,
        });
      }

      const idSet = new Set(ids);
      setCategoryOverrides((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          const key = keyFor(id);
          next[key] = category;
          if (key !== id) delete next[id];
        }
        return next;
      });
      setGmailMessages((prev) =>
        prev.map((m) =>
          idSet.has(m.id)
            ? {
                ...m,
                category,
                categorySource: "manual_override" as const,
                categoryConfidence: 1,
              }
            : m,
        ),
      );

      for (const id of ids) {
        void persistEmailOverrideToAccount({
          emailId: id,
          overriddenCategory: category,
          accountId: accountById.get(id),
        });
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

      if (category === "promotions" || category === "newsletters") {
        handleCategoryTabChange(category);
      }

      trackEvent("bulk_action_used", {
        bulk_action_type: `move:${category}`,
        count: ids.length,
      });
      offerCategoryUndo(snapshot, category, ids.length);
      selection.clear();
    },
    [selection, gmailMessages, categoryOverrides, offerCategoryUndo, applyCategoryToIds, handleCategoryTabChange],
  );

  // Bulk read-state changes group ids by account so each Gmail mailbox
  // receives only its own message ids.
  const groupIdsByAccount = useCallback((ids: string[]) => {
    const accountById = new Map(
      gmailMessagesRef.current.map((m) => [m.id, m.accountId] as const),
    );
    const groups = new Map<string | undefined, string[]>();
    for (const id of ids) {
      const accountId = accountById.get(id);
      const list = groups.get(accountId) ?? [];
      list.push(id);
      groups.set(accountId, list);
    }
    return groups;
  }, []);

  const handleBulkMarkRead = useCallback(() => {
    const ids = [...selection.selectedIds];
    for (const [accountId, group] of groupIdsByAccount(ids)) {
      markEmailsRead(group, { accountId });
    }
    trackEvent("bulk_action_used", { bulk_action_type: "mark_read", count: ids.length });
  }, [selection.selectedIds, groupIdsByAccount]);

  const handleBulkMarkUnread = useCallback(() => {
    const ids = [...selection.selectedIds];
    for (const [accountId, group] of groupIdsByAccount(ids)) {
      markEmailsUnread(group, { accountId });
    }
    trackEvent("bulk_action_used", { bulk_action_type: "mark_unread", count: ids.length });
  }, [selection.selectedIds, groupIdsByAccount]);

  const handleSelectAllVisible = useCallback(() => {
    const source =
      activeCategoryTab === "all"
        ? gmailBuckets.allVisible
        : gmailBuckets.byCategoryAll[activeCategoryTab] ?? [];
    selection.selectAll(source.map((m) => m.id));
  }, [selection, gmailBuckets.allVisible, gmailBuckets.byCategoryAll, activeCategoryTab]);

  const handleSelectAllInSection = useCallback(
    (category: InboxAiCategory) => {
      const source =
        activeCategoryTab === category
          ? gmailBuckets.byCategoryAll[category]
          : gmailBuckets.byCategory[category];
      const ids = (source ?? []).map((m) => m.id);
      if (ids.length) selection.selectMany(ids);
    },
    [selection, gmailBuckets.byCategory, gmailBuckets.byCategoryAll, activeCategoryTab],
  );

  const handleBulkComplete = useCallback(
    async (actionId: CompletionActionId, actionLabel: string) => {
      const ids = [...selection.selectedIds];
      if (ids.length === 0) return;

      const byId = new Map(gmailMessages.map((m) => [m.id, m]));
      await completeEmails(
        ids.map((id) => {
          const m = byId.get(id);
          return {
            emailId: id,
            actionId,
            actionLabel,
            sender: m?.sender ?? "",
            subject: m?.subject ?? "",
            snippet: m?.snippet,
            threadId: m?.threadId,
            category: m?.category ?? "worth_your_attention",
            accountId: m?.accountId,
            accountEmail: m?.accountEmail,
            accountLabel: m?.accountLabel,
          };
        }),
        { locale: inboxLocale },
      );

      notifyCompleted({
        emailIds: ids,
        actionId,
        actionLabel,
        locale: inboxLocale,
      });
      selection.clear();
      trackEvent("bulk_action_used", {
        bulk_action_type: "complete",
        count: ids.length,
        action_id: actionId,
      });
    },
    [selection, gmailMessages, completeEmails, inboxLocale, notifyCompleted],
  );

  // Archive / Delete: optimistic local dismissal, fully reversible via undo.
  const dismissSelected = useCallback(
    (actionType: "archive" | "delete") => {
      const ids = [...selection.selectedIds];
      if (ids.length === 0) return;

      // Dismissed entries are account-scoped — raw Gmail ids collide across
      // mailboxes.
      const accountById = new Map(
        gmailMessagesRef.current.map((m) => [m.id, m.accountId] as const),
      );
      const scopedIds = ids.map((id) => scopedEmailKey(id, accountById.get(id)));

      addDismissedIds(scopedIds);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        for (const key of scopedIds) next.add(key);
        return next;
      });
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
          removeDismissedIds(scopedIds);
          setDismissedIds((prev) => {
            const next = new Set(prev);
            for (const key of scopedIds) next.delete(key);
            return next;
          });
        },
      });
      selection.clear();
    },
    [selection, inboxLocale, offerActionUndo],
  );

  const handleBulkArchive = useCallback(() => dismissSelected("archive"), [dismissSelected]);
  const handleBulkDelete = useCallback(() => dismissSelected("delete"), [dismissSelected]);

  const handleArchiveEmailInZero = useCallback(
    (message: GmailCardMessage) => {
      const scopedId = scopedEmailKey(message.id, message.accountId);
      addDismissedIds([scopedId]);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(scopedId);
        return next;
      });
      trackEvent("bulk_action_used", { bulk_action_type: "archive", count: 1, source: "inbox_zero" });
      const verb =
        inboxLocale === "it" ? "Email archiviata" : "Archived";
      offerActionUndo({
        message: verb,
        actionType: "archive",
        onUndo: () => {
          removeDismissedIds([scopedId]);
          setDismissedIds((prev) => {
            const next = new Set(prev);
            next.delete(scopedId);
            return next;
          });
        },
      });
    },
    [inboxLocale, offerActionUndo],
  );

  // ---- Inbox Zero enhancement layer ----
  const [zeroSession, setZeroSession] = useState<{
    mode: "quick_replies" | "inbox_zero";
    steps: InboxZeroStep[];
  } | null>(null);

  // One-click: move all visible promotions to Handled, with undo.
  const handleClearPromotions = useCallback(() => {
    const ids = gmailBuckets.promotionEmails.map((m) => m.id);
    if (ids.length === 0) return;

    const snapshot = buildCategoryUndoSnapshot({
      scope: "this_email",
      triggerEmailId: ids[0],
      newCategory: "good_to_know",
      messages: gmailMessages,
      categoryOverrides,
      explicitAffectedIds: ids,
    });

    applyCategoryToIds(ids, "good_to_know");
    trackEvent("clear_promotions_used", { count: ids.length });

    const message =
      inboxLocale === "it"
        ? `${ids.length} email svuotate`
        : `${ids.length} email${ids.length === 1 ? "" : "s"} cleared`;
    offerCategoryUndo(snapshot, "good_to_know", ids.length, message);
    selection.clear();
  }, [
    gmailBuckets.promotionEmails,
    gmailMessages,
    categoryOverrides,
    applyCategoryToIds,
    offerCategoryUndo,
    inboxLocale,
    selection,
  ]);

  const handleStartQuickReplies = useCallback(() => {
    const emails = gmailBuckets.byCategory.worth_your_attention ?? [];
    if (emails.length === 0) return;
    const steps: InboxZeroStep[] = emails.map((message) => ({
      kind: "email",
      category: "worth_your_attention",
      message: message as GmailCardMessage,
    }));
    trackEvent("quick_reply_queue_started", { count: emails.length });
    setZeroSession({ mode: "quick_replies", steps });
  }, [gmailBuckets.byCategory]);

  const handleStartInboxZero = useCallback(() => {
    handleInboxInteractionModeChange("inbox_zero");
    trackEvent("inbox_zero_started", {
      source: "briefing",
      queue: buildInboxZeroQueue(
        activeCategoryTab,
        gmailBuckets,
        filterInboxList,
        isCompleted,
      ).length,
    });
  }, [
    handleInboxInteractionModeChange,
    activeCategoryTab,
    gmailBuckets,
    filterInboxList,
    isCompleted,
  ]);

  // Completing an email in a session clears it from the inbox (reversible via dismissed store).
  const completeEmailInZero = useCallback(
    async (
      _id: string,
      _category: InboxAiCategory,
      actionId: CompletionActionId,
      actionLabel: string,
      extras?: import("@/lib/email-completions/types").CompleteEmailExtras,
    ) => {
      const id = _id;
      const m = gmailMessages.find((row) => row.id === id);
      await completeEmails(
        [
          {
            emailId: id,
            actionId,
            actionLabel,
            sender: m?.sender ?? "",
            subject: m?.subject ?? "",
            snippet: m?.snippet,
            threadId: m?.threadId,
            category: m?.category ?? "worth_your_attention",
            accountId: m?.accountId,
            accountEmail: m?.accountEmail,
            accountLabel: m?.accountLabel,
            ...extras,
          },
        ],
        { locale: inboxLocale },
      );
      applyDoneInboxEffects([{ id, accountId: m?.accountId }], { actionId });
      notifyCompleted({
        emailIds: [id],
        actionId,
        actionLabel,
        locale: inboxLocale,
      });
    },
    [gmailMessages, completeEmails, notifyCompleted, inboxLocale],
  );

  const clearPromotionsInZero = useCallback(
    (ids: string[]) => {
      applyCategoryToIds(ids, "good_to_know");
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
    if (inboxMode !== "gmail" || zeroSession || inboxInteractionMode === "inbox_zero") return;
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
        handleBulkComplete(
          "no_action_needed",
          inboxLocale === "it" ? "Nessuna azione" : "No action needed",
        );
      } else if (key === "p") {
        e.preventDefault();
        handleBulkCategoryChange("promotions");
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
    inboxInteractionMode,
    selection.count,
    handleSelectAllVisible,
    handleBulkComplete,
    handleBulkCategoryChange,
    handleBulkArchive,
    inboxLocale,
  ]);

  useEffect(() => {
    if (inboxInteractionMode !== "inbox_zero") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      handleInboxInteractionModeChange("standard");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inboxInteractionMode, handleInboxInteractionModeChange]);

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

      const accountId = gmailMessagesRef.current.find((m) => m.id === id)?.accountId;
      const scopedKey = scopedEmailKey(id, accountId);

      if (scope === "sender" && options?.sender) {
        logSenderRuleDebug("handleCategoryChange sender scope", {
          emailId: id,
          ...resolveSenderIdentity(options.sender),
          category,
        });
        // Gap #2: sender-scope changes must NOT write per-email manual
        // override state for matched emails — that would mask persisted
        // manual overrides. The sender rule itself (persisted separately)
        // drives the recategorization, and manual overrides keep outranking
        // it at resolution time. Only the trigger email's own pre-existing
        // manual override is refreshed to the user's latest choice, so a
        // stale override can't snap it back.
        const hasExistingOverride =
          lookupScopedValue(categoryOverrides, id, accountId) !== undefined ||
          lookupScopedValue(loadClientEmailOverrideMap(), id, accountId) !== undefined;
        if (hasExistingOverride) {
          setCategoryOverrides((prev) => {
            const next = { ...prev };
            next[scopedKey] = category;
            if (scopedKey !== id) delete next[id];
            return next;
          });
          void persistEmailOverrideToAccount({
            emailId: id,
            overriddenCategory: category,
            originalCategory: options?.guessedCategory,
            accountId,
          });
        }
      } else {
        const now = new Date().toISOString();
        upsertClientEmailOverride({
          emailId: scopedKey,
          originalCategory: options?.guessedCategory ?? null,
          overriddenCategory: category,
          createdAt: now,
          updatedAt: now,
        });
        setCategoryOverrides((prev) => {
          const next = { ...prev, [scopedKey]: category };
          if (scopedKey !== id) delete next[id];
          return next;
        });
        setGmailMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  category,
                  categorySource: "manual_override" as const,
                  categoryConfidence: 1,
                }
              : m,
          ),
        );
        void persistEmailOverrideToAccount({
          emailId: id,
          overriddenCategory: category,
          originalCategory: options?.guessedCategory,
          accountId,
        });
        void collectUserOverrideLog({
          emailId: id,
          accountId,
          sender: gmailMessages.find((m) => m.id === id)?.sender ?? "",
          subject: gmailMessages.find((m) => m.id === id)?.subject,
          previousCategory: options?.guessedCategory ?? null,
          newCategory: category,
          scope: "this_email",
        });
      }

      offerCategoryUndo(snapshot, category);

      // Jump to the destination tab so moved emails never feel like they vanished.
      if (scope === "this_email") {
        handleCategoryTabChange(category);
      }
    },
    [gmailMessages, categoryOverrides, offerCategoryUndo, handleCategoryTabChange, collectUserOverrideLog],
  );

  const handleRecategorizeInZero = useCallback(
    async (
      id: string,
      chosen: InboxAiCategory,
      scope: CategoryApplyScope,
      meta: InboxZeroRecategorizeMeta,
    ) => {
      handleCategoryChange(id, chosen, {
        scope,
        sender: meta.sender,
        guessedCategory: meta.guessedCategory,
      });

      try {
        const result = await submitCategoryFeedback({
          emailId: id,
          sender: meta.sender,
          subject: meta.subject,
          snippet: meta.snippet,
          guessedCategory: meta.guessedCategory,
          chosenCategory: chosen,
          scope,
          accountId: gmailMessagesRef.current.find((m) => m.id === id)?.accountId,
        });
        if (scope === "this_email") {
          window.dispatchEvent(new Event("handled-email-overrides-changed"));
        } else {
          window.dispatchEvent(new Event("handled-inbox-rules-changed"));
          window.dispatchEvent(new Event("handled-sender-preferences-changed"));
          if (result.affectedCount && result.affectedCount > 0) {
            window.dispatchEvent(new Event("handled-inbox-refresh-requested"));
          }
        }
      } catch {
        /* local override already applied */
      }
    },
    [handleCategoryChange, submitCategoryFeedback],
  );

  const handleResetCategoryOverride = useCallback(
    async (id: string) => {
      dismissUndoToast();
      const accountId = gmailMessagesRef.current.find((m) => m.id === id)?.accountId;
      await removeEmailOverrideFromAccount(id, accountId);
      setCategoryOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        delete next[scopedEmailKey(id, accountId)];
        return next;
      });
      void loadInbox({ silent: true, refresh: true });
    },
    [loadInbox, dismissUndoToast],
  );

  const attentionSnapshot: AttentionSnapshot = useMemo(
    () => ({
      needsAttention: gmailBuckets.todayAttentionCount,
      waitingOn: waitingOpenRecords.length,
      goodToKnow: gmailBuckets.counts.good_to_know ?? 0,
      newsletter: gmailBuckets.newsletterEmails.length,
      promotion: gmailBuckets.promotionEmails.length,
      clutter: gmailBuckets.clutterCount,
      totalVisible: gmailBuckets.allVisible.length,
    }),
    [gmailBuckets, waitingOpenRecords.length],
  );
  const todayHeadline =
    emotionalMemory.welcomeLine ??
    calmTodayHeadline(attentionSnapshot, inboxLocale);
  const reliefMessage = useMemo(
    () =>
      inboxLoading
        ? null
        : emotionalMemory.welcomeSubline ??
          pickFocusReassurance(attentionSnapshot, inboxLocale),
    [
      inboxLoading,
      emotionalMemory.welcomeSubline,
      attentionSnapshot,
      inboxLocale,
    ],
  );
  const inboxErrorDisplay =
    structuredInboxError ??
    handledErrorFromInboxFailure(inboxFailureReason ?? "unknown", inboxLocale);

  const workflowProfile = getWorkflowModeProfile(workflowMode);

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        {showGuidedOnboarding ? (
          <GuidedOnboardingFlow
            locale={inboxLocale}
            inboxMode={inboxMode}
            signedIn={signedIn}
            connectedAccountCount={connectedAccounts.length}
            messages={messagesWithOverrides}
            readStateMap={readStateMap}
            isCompleted={isCompleted}
            onFinished={handleFirstOnboardingFinished}
            onFetchMoreExamples={fetchOnboardingExamples}
            compactMode={onboardingAdaptive.compactOnboarding}
            skipPersonalize={onboardingAdaptive.skipPersonalizeStep}
          />
        ) : inboxLoading ? (
          <InboxLoadingState
            locale={inboxLocale}
            message={loadingMicroMessages[messageIndex]}
          />
        ) : (
          <>
        <header
          className={`flex flex-wrap items-start justify-between gap-4 transition-opacity duration-500 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="min-w-0 space-y-3">
            <InboxViewNav locale={inboxLocale} />
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {ui.home.heroTitle}
            </h1>
            <p className="text-sm leading-relaxed text-gray-500">{ui.home.inboxTagline}</p>
            {!betaMode ? (
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
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {signedIn ? (
              <AttachInboxButton locale={inboxLocale} variant="header" />
            ) : null}
            <AuthNav />
            <Link href="/settings" className="link-accent text-xs">
              {ui.home.settingsButton}
            </Link>
          </div>
        </header>

        <section
          className={`mt-10 space-y-10 transition-opacity duration-500 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          {inboxMode === "no_google" ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">{ui.home.connectGmailTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {gmailError || ui.home.connectGmailBody}
              </p>
              {signedIn ? (
                <div className="mt-4">
                  <AttachInboxButton locale={inboxLocale} variant="primary" />
                </div>
              ) : (
                <Link
                  href="/login"
                  className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
                >
                  Continue with Google
                </Link>
              )}
            </div>
          ) : inboxMode === "gmail_error" ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                {inboxErrorDisplay.title ?? ui.home.inboxErrorTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {inboxErrorDisplay.userMessage}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {inboxErrorDisplay.action === "sign_out" ? (
                  <button
                    type="button"
                    onClick={() => {
                      void supabaseBrowser.auth.signOut().then(() => {
                        router.push("/login");
                        router.refresh();
                      });
                    }}
                    className="btn-primary-sm"
                  >
                    {inboxErrorDisplay.actionLabel || ui.calm.errors.tryAgain}
                  </button>
                ) : inboxErrorDisplay.action === "retry" ||
                  inboxErrorDisplay.action === "reconnect_gmail" ? (
                  <button
                    type="button"
                    onClick={() => void loadInbox()}
                    className="btn-primary-sm"
                  >
                    {inboxErrorDisplay.actionLabel || ui.calm.errors.tryAgain}
                  </button>
                ) : null}
                {inboxErrorDisplay.action === "connect_account" && signedIn ? (
                  <AttachInboxButton locale={inboxLocale} variant="primary" />
                ) : null}
                {inboxFailureReason === "auth_error" && signedIn ? (
                  <AttachInboxButton locale={inboxLocale} variant="primary" />
                ) : null}
              </div>
            </div>
          ) : inboxMode === "gmail_empty" ? (
            <InboxEmptyState
              tone="calm"
              title={INBOX_ZERO_STATE_COPY[inboxLocale].title}
              subtitle={INBOX_ZERO_STATE_COPY[inboxLocale].subtitle}
              footer={INBOX_ZERO_STATE_COPY[inboxLocale].footer}
            />
          ) : inboxMode === "gmail" ? (
            <div className="space-y-8">
              {attachNotice ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-800">
                  {attachNotice}
                </p>
              ) : null}
              <InboxSyncBar
                lastSyncedAt={lastSyncedAt}
                isRefreshing={isRefreshing}
                rateLimitNotice={rateLimitNotice}
                locale={inboxLocale}
                onRefresh={() => void loadInbox({ silent: true, refresh: true, force: true })}
              />
              {!betaMode && !isSearchActive ? (
                <TodaysFocusCard
                  locale={inboxLocale}
                  focusEmails={focusEmails}
                  attentionCount={focusAttentionCount}
                  handledElsewhereCount={handledElsewhereCount}
                />
              ) : null}
              {!betaMode ? (
                <InboxSearchBar
                  locale={inboxLocale}
                  accounts={connectedAccounts}
                  filters={searchFilters}
                  onFiltersChange={setSearchFilters}
                  resultCount={
                    isSearchActive
                      ? searchResultSet.inbox.length + searchResultSet.completedOnly.length
                      : undefined
                  }
                  loading={searchLoading}
                />
              ) : null}
              {!betaMode && isSearchActive ? (
                <InboxSearchResults
                  locale={inboxLocale}
                  messages={searchResultSet.inbox}
                  completedOnly={searchResultSet.completedOnly}
                  loading={searchLoading}
                  errorMessage={searchError}
                  catalog={catalog}
                  readStateMap={readStateMap}
                  showAccountBadges={connectedAccounts.length > 1}
                  onCategoryChange={handleCategoryChange}
                  onResetOverride={handleResetCategoryOverride}
                />
              ) : (
                <>
              <InboxSourceSwitcher
                accounts={connectedAccounts}
                value={activeAccountFilter}
                locale={inboxLocale}
                onChange={handleAccountFilterChange}
              />
              {betaMode ? (
                <BetaAiFilterBar
                  active={betaAiFilter}
                  counts={betaAiFilterCounts}
                  locale={inboxLocale}
                  onChange={setBetaAiFilter}
                />
              ) : null}
              <InboxModeToggle
                mode={inboxInteractionMode}
                locale={inboxLocale}
                queueCount={inboxZeroQueue.length}
                onChange={handleInboxInteractionModeChange}
              />
              {!betaMode && !isSearchActive && timeStripGroups.length > 0 ? (
                <InboxTimeStrip groups={timeStripGroups} locale={inboxLocale} />
              ) : null}
              {autopilotWorkflowClear &&
              activeCategoryTab === "all" &&
              inboxInteractionMode === "standard" ? (
                <InboxEmptyState
                  tone="calm"
                  title={
                    inboxLocale === "it"
                      ? "Handled ha organizzato la tua posta"
                      : "Handled organized your mail"
                  }
                  subtitle={
                    inboxLocale === "it"
                      ? "Niente da rivedere qui. Ogni azione automatica è nel Registro — annullabile in qualsiasi momento."
                      : "Nothing to review here. Every automatic action is in Handled Log — reversible anytime."
                  }
                  footer={
                    inboxLocale === "it"
                      ? "Correggi o annulla quando vuoi. Altre categorie restano nelle schede sotto."
                      : "Correct or undo whenever you want. Other categories remain in the tabs below."
                  }
                />
              ) : null}
              <WaitingOnInboxSection
                locale={inboxLocale}
                records={waitingOpenRecords}
              />
              <div className="sticky top-0 z-10 -mx-1 bg-white/90 py-3 backdrop-blur-sm">
                <CategoryTabs
                  active={activeCategoryTab}
                  counts={gmailBuckets.counts}
                  total={gmailBuckets.totalAccessible}
                  locale={inboxLocale}
                  onChange={handleCategoryTabChange}
                />
              </div>
              {inboxInteractionMode === "inbox_zero" ? (
                <InboxZeroFlowView
                  messages={inboxZeroQueue}
                  locale={inboxLocale}
                  readStateMap={readStateMap}
                  activeCategoryTab={activeCategoryTab}
                  onExit={() => handleInboxInteractionModeChange("standard")}
                  onArchiveEmail={handleArchiveEmailInZero}
                  onCategoryChange={handleCategoryChange}
                />
              ) : activeCategoryTab === "all" ? (
                <>
                  {gmailBuckets.counts.worth_your_attention === 0 &&
                  gmailBuckets.allVisible.length > 0 &&
                  !autopilotWorkflowClear ? (
                    <section className="space-y-3">
                      <GmailCategorySectionHeader
                        category="worth_your_attention"
                        locale={uiLanguage}
                        count={0}
                      />
                      <InboxEmptyState
                        compact
                        tone="attention"
                        title={categoryEmptyMessage("worth_your_attention", inboxLocale, catalog)}
                        subtitle={completionCopy.subtitle}
                      />
                    </section>
                  ) : null}
                  {autopilotWorkflowClear ? null : gmailBuckets.categoryOrder.map((category) => {
                    const list = filterWorkflowSection(
                      gmailBuckets.byCategory[category] as GmailCardMessage[],
                    );
                    if (!list.length) return null;
                    return (
                      <GmailCategorySection
                        key={category}
                        category={category}
                        list={list}
                        uiLanguage={uiLanguage}
                        count={list.length}
                        onSelectAll={() => handleSelectAllInSection(category)}
                        showContent={showContent}
                        selection={selection}
                        readStateMap={readStateMap}
                        onCategoryChange={handleCategoryChange}
                        onResetOverride={handleResetCategoryOverride}
                        activeCategoryTab={activeCategoryTab}
                        showAccountBadges={connectedAccounts.length > 1}
                      />
                    );
                  })}
                  {gmailBuckets.showClutterSection ||
                  (autopilotWorkflowClear &&
                    filterInboxList(
                      [
                        ...(gmailBuckets.byCategoryAll.promotions ?? []),
                        ...(gmailBuckets.byCategoryAll.newsletters ?? []),
                      ] as GmailCardMessage[],
                      { categoryTabOnly: true },
                    ).length > 0) ? (
                    <InboxClutterSection
                      messages={filterInboxList(
                        (autopilotWorkflowClear
                          ? [
                              ...(gmailBuckets.byCategoryAll.promotions ?? []),
                              ...(gmailBuckets.byCategoryAll.newsletters ?? []),
                            ]
                          : gmailBuckets.clutterEmails) as GmailCardMessage[],
                        { categoryTabOnly: true },
                      )}
                      locale={uiLanguage === "it" ? "it" : "en"}
                      onCategoryChange={handleCategoryChange}
                      readStateMap={readStateMap}
                      defaultCollapsed
                      inboxReturnCapture={{ view: "inbox", categoryTab: activeCategoryTab }}
                      onOpenPromotionsTab={() => handleCategoryTabChange("promotions")}
                      showAccountBadges={connectedAccounts.length > 1}
                    />
                  ) : null}
                  {betaFilterActive &&
                  filterInboxList(gmailBuckets.allVisible as GmailCardMessage[]).length === 0 &&
                  gmailBuckets.allVisible.length > 0 ? (
                    <InboxEmptyState
                      compact
                      tone="calm"
                      title={
                        inboxLocale === "it"
                          ? "Nessuna email corrisponde a questo filtro IA"
                          : "No emails match this AI filter"
                      }
                      subtitle={
                        inboxLocale === "it"
                          ? "Passa a Tutte le email o scegli una categoria — nulla è nascosto."
                          : "Switch to All emails or pick a category — nothing is hidden."
                      }
                    />
                  ) : null}
                </>
              ) : (() => {
                const rawList = (gmailBuckets.byCategoryAll[activeCategoryTab] ??
                  []) as GmailCardMessage[];
                const list = filterInboxList(rawList, { categoryTabOnly: true });
                if (list.length > 0) {
                  return (
                <div className="space-y-4">
                  <CategoryViewGuidance
                    category={activeCategoryTab}
                    locale={inboxLocale}
                    workflowMode={workflowMode}
                    count={list.length}
                  />
                  <GmailCategorySection
                    category={activeCategoryTab}
                    list={list}
                    uiLanguage={uiLanguage}
                    count={list.length}
                    onSelectAll={() => handleSelectAllInSection(activeCategoryTab)}
                    showContent={showContent}
                    selection={selection}
                    readStateMap={readStateMap}
                    onCategoryChange={handleCategoryChange}
                    onResetOverride={handleResetCategoryOverride}
                    activeCategoryTab={activeCategoryTab}
                    showAccountBadges={connectedAccounts.length > 1}
                  />
                </div>
                  );
                }
                if (
                  betaFilterActive &&
                  rawList.length > 0 &&
                  list.length === 0
                ) {
                  return (
                    <InboxEmptyState
                      compact
                      tone="calm"
                      title={
                        inboxLocale === "it"
                          ? "Nessuna email corrisponde a questo filtro IA"
                          : "No emails match this AI filter"
                      }
                      subtitle={
                        inboxLocale === "it"
                          ? "Passa a Tutte le email per vedere tutto in questa categoria."
                          : "Switch to All emails to see everything in this category."
                      }
                    />
                  );
                }
                return (
                <InboxEmptyState
                  tone="calm"
                  title={categoryEmptyMessage(activeCategoryTab, inboxLocale, catalog)}
                />
                );
              })()}
              {!betaMode ? (
              <InboxSecondaryTools
                messages={messagesForDisplay as GmailCardMessage[]}
                gmailMessages={gmailMessages as GmailCardMessage[]}
                allVisible={gmailBuckets.allVisible as GmailCardMessage[]}
                locale={uiLanguage === "it" ? "it" : "en"}
                onCategoryChange={handleCategoryChange}
              />
              ) : null}
              {nextPageToken ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-gray-600 transition hover:border-accent/40 hover:text-accent disabled:opacity-60"
                  >
                    {isLoadingMore
                      ? calmLoadMoreMessage(inboxLocale)
                      : inboxLocale === "it"
                        ? "Carica altre email"
                        : "Load more emails"}
                  </button>
                </div>
              ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>
          </>
        )}
      </div>

      {undoToast ? (
        <CategoryUndoToast
          message={undoMessage}
          undoLabel={undoLabel}
          onUndo={() => void performUndo()}
          onDismiss={dismissUndoToast}
        />
      ) : null}

      {inboxMode === "gmail" && inboxInteractionMode !== "inbox_zero" && !undoToast && !showGuidedOnboarding ? (
        <BulkActionBar
          count={selection.count}
          totalVisible={gmailBuckets.allVisible.length}
          locale={inboxLocale}
          onMoveTo={handleBulkCategoryChange}
          onCompleteWith={handleBulkComplete}
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
          onRecategorizeEmail={handleRecategorizeInZero}
          onClearPromotions={clearPromotionsInZero}
          onFinished={handleZeroFinished}
          onClose={() => setZeroSession(null)}
        />
      ) : null}

      <LanguageFooterToggle className="mt-12 pb-6" />
    </main>
  );
}
