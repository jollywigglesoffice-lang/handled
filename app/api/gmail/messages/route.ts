import { NextResponse } from "next/server";
import { EMPTY_CATEGORY_CATALOG } from "@/lib/inbox-category-catalog";
import { categorizeGmailInboxRows, intelligentFallbackCategory, loadCategorizationContext } from "@/lib/domain/categorization";
import { stampEmailOverridesOnMessages } from "@/lib/email-overrides/apply-to-messages";

export const dynamic = "force-dynamic";
import { GmailApiError } from "@/lib/gmail-api-error";
import { listConnectedGmailAccounts } from "@/lib/google/connected-accounts";
import { fetchUnifiedInboxPage, mergeUnifiedInboxRows } from "@/lib/gmail/fetch-unified-inbox";
import { ONBOARDING_BROAD_GMAIL_QUERY } from "@/lib/onboarding/example-buckets";
import {
  INBOX_INITIAL_PAGE_SIZE,
  INBOX_LOAD_MORE_PAGE_SIZE,
  INBOX_REFRESH_PAGE_SIZE,
} from "@/lib/inbox-load/constants";
import {
  computeBackoffDelayMs,
  parseRetryAfterMs,
} from "@/lib/inbox-load/rate-limit-backoff";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";
import { parseWorkflowModeHeader } from "@/lib/workflow-mode-effects";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";
import { enrichMessageWithActionIntelligence } from "@/lib/action-intelligence";
import { analyzeActionIntelligence } from "@/lib/action-intelligence/analyze";
import { enrichInboxWithTimelineIntelligence } from "@/lib/timeline-intelligence";
import { enrichMessageWithCalendarAwareness } from "@/lib/calendar-awareness";
import { classifyCalendarIntent } from "@/lib/calendar-awareness/classify-intent";
import { classifyTimeImpact } from "@/lib/time-impact/classify";
import { classifyAutopilot } from "@/lib/autopilot/classify";
import { resolveSenderRelationship } from "@/lib/relationship-intelligence/resolve";
import { hasUnsubscribeSignal } from "@/lib/unsubscribe/detect";
import {
  classifyGmailThrownError,
  classifySupabaseError,
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
import { inboxLoadUserMessage } from "@/lib/inbox-load/user-messages";
import { handledErrorFromInboxFailure } from "@/lib/handled-errors";
import type {
  InboxLoadDiagnostics,
  InboxLoadFailureReason,
  InboxLoadStage,
  InboxLoadTimings,
} from "@/lib/inbox-load/types";

function inboxErrorResponse(
  applyAuthCookies: (r: NextResponse) => NextResponse,
  input: {
    status: number;
    failureReason: InboxLoadFailureReason;
    failureStage: InboxLoadStage;
    message: string;
    diagnostics: InboxLoadDiagnostics;
    accountId?: string | null;
    gmailStatus?: number | null;
    gmailReason?: string | null;
    retryAfterMs?: number | null;
    backoffDelayMs?: number;
  },
): NextResponse {
  logInboxLoadFailed({
    ...input.diagnostics,
    failureReason: input.failureReason,
    failureStage: input.failureStage,
    gmailStatus: input.gmailStatus ?? null,
    gmailReason: input.gmailReason ?? null,
  });

  logInboxApiError({
    endpoint: "/api/gmail/messages",
    httpStatus: input.status,
    accountId: input.accountId ?? null,
    failureReason: input.failureReason,
    failureStage: input.failureStage,
    loadId: input.diagnostics.loadId,
    errorBody: {
      error: input.failureReason,
      message: input.message,
      gmailStatus: input.gmailStatus ?? null,
      gmailReason: input.gmailReason ?? null,
    },
  });

  const structured = handledErrorFromInboxFailure(input.failureReason);

  return applyAuthCookies(
    NextResponse.json(
      {
        error: input.failureReason,
        failureReason: input.failureReason,
        failureStage: input.failureStage,
        message: input.message,
        code: structured.code,
        category: structured.category,
        userMessage: structured.userMessage,
        actionLabel: structured.actionLabel,
        action: structured.action,
        title: structured.title,
        accountId: input.accountId ?? null,
        gmailStatus: input.gmailStatus ?? null,
        gmailReason: input.gmailReason ?? null,
        retryAfterMs: input.retryAfterMs ?? null,
        backoffDelayMs: input.backoffDelayMs ?? null,
        diagnostics: input.diagnostics,
      },
      { status: input.status },
    ),
  );
}

export async function GET(request: Request) {
  const loadId = createInboxLoadId();
  const startedAt = Date.now();
  const searchParams = new URL(request.url).searchParams;
  const pageToken = searchParams.get("pageToken");
  const refresh = searchParams.get("refresh") === "1";
  const onboardingMode = searchParams.get("onboarding") === "1";
  const accountFilterId = searchParams.get("accountId");
  const paginated = Boolean(pageToken);

  const maxResults = pageToken
    ? INBOX_LOAD_MORE_PAGE_SIZE
    : refresh
      ? INBOX_REFRESH_PAGE_SIZE
      : INBOX_INITIAL_PAGE_SIZE;

  let timings: InboxLoadTimings = {};
  const baseDiagnostics = (): InboxLoadDiagnostics => ({
    loadId,
    startedAt,
    paginated,
    pageToken,
    refresh,
    timings: { ...timings, totalMs: elapsedMs(startedAt) },
  });

  logInboxLoadStart({ loadId, paginated, pageToken, append: paginated, refresh });

  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);

  const authStarted = Date.now();
  const authResult = await requireApiAuth(request, supabase);
  timings = mergeTimings(timings, { authMs: elapsedMs(authStarted) });

  if (!authResult.ok) {
    const status = authResult.response.status;
    const failureReason = status >= 500 ? "server_unavailable" : "auth_error";
    return inboxErrorResponse(applyAuthCookies, {
      status,
      failureReason,
      failureStage: "auth",
      message: inboxLoadUserMessage(failureReason),
      accountId: accountFilterId,
      diagnostics: baseDiagnostics(),
    });
  }

  const { auth } = authResult;
  const tokenStarted = Date.now();
  const googleAuth = await requireGoogleProviderToken(auth, {
    message: "Sign in with Google to load your Gmail inbox.",
  });
  timings = mergeTimings(timings, { googleTokenMs: elapsedMs(tokenStarted) });

  if (!googleAuth.ok) {
    const failureReason = googleAuth.failureReason;
    return inboxErrorResponse(applyAuthCookies, {
      status: googleAuth.response.status,
      failureReason,
      failureStage: "google_token",
      message: inboxLoadUserMessage(failureReason),
      accountId: accountFilterId,
      diagnostics: baseDiagnostics(),
    });
  }

  const userId = auth.user.id;

  try {
    const accounts = await listConnectedGmailAccounts(userId, auth.user.email);
    if (accounts.length === 0) {
      // googleAuth.ok above means a usable token exists (legacy users-table path),
      // so an empty account list here means the connected_gmail_accounts table is
      // missing or the migration insert failed — not that the user lacks Gmail OAuth.
      console.error(
        "[api/gmail/messages] no connected accounts for user with valid Google token",
        { userId, loadId },
      );
      return inboxErrorResponse(applyAuthCookies, {
        status: 403,
        failureReason: "missing_account",
        failureStage: "google_token",
        message: inboxLoadUserMessage("missing_account"),
        accountId: accountFilterId,
        diagnostics: baseDiagnostics(),
      });
    }

    const listStarted = Date.now();
    let { rows, gmailTruth } = await fetchUnifiedInboxPage({
      userId,
      accounts,
      accountFilterId,
      maxResults,
      pageToken,
    });

    if (onboardingMode && !paginated && rows.length < 3) {
      const broad = await fetchUnifiedInboxPage({
        userId,
        accounts,
        accountFilterId,
        maxResults: Math.max(maxResults, 100),
        query: ONBOARDING_BROAD_GMAIL_QUERY,
      });
      rows = mergeUnifiedInboxRows(rows, broad.rows, Math.max(maxResults, 100));
    }

    timings = mergeTimings(timings, {
      gmailListMs: elapsedMs(listStarted),
      gmailMetadataMs: elapsedMs(listStarted),
    });
    const nextPageToken = null;

    const supabaseStarted = Date.now();
    const rulesCtx = userId
      ? await loadCategorizationContext(userId, request)
      : {
          emailOverrides: {},
          emailOverrideRecords: [],
          memoryRules: [],
          memorySnapshot: { senderMemory: [], categoryCorrections: [], categoryPatterns: [], actionMemory: [] },
          senderRules: [],
          keywordRules: [],
          allRules: [],
          senderRelationships: [],
          personalCategories: [],
          categoryCatalog: EMPTY_CATEGORY_CATALOG,
        };
    timings = mergeTimings(timings, { supabaseMs: elapsedMs(supabaseStarted) });

    const workflowMode = parseWorkflowModeHeader(
      request.headers.get(WORKFLOW_MODE_HEADER),
    );

    const categorizeStarted = Date.now();
    const categorized = onboardingMode
      ? rows.map((row) => {
          const hint = intelligentFallbackCategory(row);
          const relationship = resolveSenderRelationship(
            row,
            "good_to_know",
            rulesCtx.senderRelationships,
          );
          return {
            ...row,
            category: "good_to_know" as const,
            categoryConfidence: 0,
            categorySource: "heuristic" as const,
            trainingHint: hint.category,
            relationship,
          };
        })
      : await categorizeGmailInboxRows(rows, {
          emailOverrides: rulesCtx.emailOverrides,
          memoryRules: rulesCtx.memoryRules,
          senderRules: rulesCtx.senderRules,
          userRules: rulesCtx.keywordRules,
          senderRelationships: rulesCtx.senderRelationships,
          workflowMode,
          categoryCatalog: rulesCtx.categoryCatalog,
        });
    timings = mergeTimings(timings, { categorizeMs: elapsedMs(categorizeStarted) });

    const enrichStarted = Date.now();
    const withTimeline = enrichInboxWithTimelineIntelligence(
      categorized.map((m) => ({ ...m, category: m.category })),
    );

    const messages = withTimeline.map((m) => {
      const withCalendar = enrichMessageWithCalendarAwareness(m);
      const analysis = analyzeActionIntelligence({
        row: m,
        category: m.category,
      });
      const enriched = enrichMessageWithActionIntelligence(withCalendar, {
        category: m.category,
      });
      const timeImpact = classifyTimeImpact({
        row: m,
        category: m.category,
        needsCalendarContext: withCalendar.needsCalendarContext,
        actionIntelligence: enriched.actionIntelligence,
      });
      const autopilot = classifyAutopilot({
        row: m,
        category: m.category,
        categoryConfidence: m.categoryConfidence,
        categorySource: m.categorySource,
        actionConfidence: analysis.confidence,
        actionState: analysis.actionState,
        primaryLabel: analysis.primaryLabel,
        timeImpactKind: timeImpact.kind,
      });
      return {
        ...enriched,
        timelineIntelligence: m.timelineIntelligence,
        relationship: m.relationship,
        hasUnsubscribeSignal: hasUnsubscribeSignal(m.snippet, m.listUnsubscribe),
        timeImpact,
        calendarIntentLevel: classifyCalendarIntent({
          row: m,
          needsCalendarContext: withCalendar.needsCalendarContext,
          timeImpactKind: timeImpact.kind,
        }),
        autopilot,
      };
    });
    timings = mergeTimings(timings, { enrichmentMs: elapsedMs(enrichStarted) });

    const messagesForClient = stampEmailOverridesOnMessages(
      messages,
      rulesCtx.emailOverrides,
    );

    timings = mergeTimings(timings, { totalMs: elapsedMs(startedAt) });
    const diagnostics: InboxLoadDiagnostics = {
      loadId,
      startedAt,
      paginated,
      pageToken,
      refresh,
      emailCount: messagesForClient.length,
      timings,
      slow: (timings.totalMs ?? 0) >= 5000,
    };

    logInboxLoadComplete({
      ...diagnostics,
      emailCount: messagesForClient.length,
    });

    if (process.env.NODE_ENV === "development") {
      const overrideCount = Object.keys(rulesCtx.emailOverrides).length;
      console.log(
        `[api/gmail/messages] ${overrideCount} email override(s), ${rulesCtx.senderRules.length} sender rule(s)`,
      );
    }

    return applyAuthCookies(
      NextResponse.json({
        messages: messagesForClient,
        categoryOverrides: rulesCtx.emailOverrides,
        emailOverrideRecords: rulesCtx.emailOverrideRecords,
        personalCategories: rulesCtx.personalCategories,
        nextPageToken: refresh ? null : nextPageToken,
        refresh,
        gmailTruth,
        accounts,
        diagnostics,
      }),
    );
  } catch (e: unknown) {
    timings = mergeTimings(timings, { totalMs: elapsedMs(startedAt) });

    let failureReason: InboxLoadFailureReason = "unknown";
    let failureStage: InboxLoadStage = "gmail_list";
    let gmailStatus: number | null = null;
    let gmailReason: string | null = null;

    const gmailClass = classifyGmailThrownError(e);
    if (gmailClass.reason !== "gmail_fetch_failed" || /gmail/i.test(String(e))) {
      failureReason = gmailClass.reason;
      gmailStatus = gmailClass.gmailStatus ?? null;
      gmailReason = gmailClass.gmailReason ?? null;
      if (timings.gmailMetadataMs != null) failureStage = "gmail_metadata";
      else if (timings.gmailListMs != null) failureStage = "gmail_list";
    } else if (timings.supabaseMs == null && timings.gmailMetadataMs != null) {
      failureReason = classifySupabaseError(e);
      failureStage = "supabase_context";
    } else if (timings.categorizeMs == null && timings.supabaseMs != null) {
      failureReason = "categorization_failure";
      failureStage = "categorization";
    } else if (timings.enrichmentMs == null && timings.categorizeMs != null) {
      failureReason = "categorization_failure";
      failureStage = "enrichment";
    } else {
      failureReason = gmailClass.reason;
    }

    let retryAfterMs: number | null = null;
    if (e instanceof GmailApiError) {
      retryAfterMs = e.retryAfterMs;
    } else if (gmailStatus === 429) {
      retryAfterMs = parseRetryAfterMs(gmailStatus, String(e));
    }
    const backoffDelayMs =
      failureReason === "gmail_rate_limit"
        ? computeBackoffDelayMs(1, retryAfterMs)
        : undefined;

    if (failureReason === "gmail_rate_limit") {
      console.warn("[inbox-load] Gmail rate limit on server", {
        loadId,
        retryAfterMs,
        backoffDelayMs,
        gmailStatus,
        gmailReason,
        refresh,
        maxResults,
      });
    }

    return inboxErrorResponse(applyAuthCookies, {
      status: failureReason === "gmail_rate_limit" ? 429 : 502,
      failureReason,
      failureStage,
      message: inboxLoadUserMessage(failureReason),
      diagnostics: {
        ...baseDiagnostics(),
        retryAfterMs,
        backoffDelayMs,
      },
      gmailStatus,
      gmailReason,
      retryAfterMs,
      backoffDelayMs,
    });
  }
}
