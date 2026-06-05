import { NextResponse } from "next/server";
import { EMPTY_CATEGORY_CATALOG } from "@/lib/inbox-category-catalog";
import { categorizeGmailInboxRows } from "@/lib/categorize-inbox-messages";
import { stampEmailOverridesOnMessages } from "@/lib/email-overrides/apply-to-messages";

export const dynamic = "force-dynamic";
import { gmailGetMessagesMetadata, gmailListInboxPage } from "@/lib/gmail-api";
import { loadCategorizationContext } from "@/lib/load-user-categorization-context";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { withGoogleAuthRetry } from "@/lib/google/google-access-token";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";
import { parseWorkflowModeHeader } from "@/lib/workflow-mode-effects";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";
import { enrichMessageWithActionIntelligence } from "@/lib/action-intelligence";
import { enrichInboxWithTimelineIntelligence } from "@/lib/timeline-intelligence";
import { enrichMessageWithCalendarAwareness } from "@/lib/calendar-awareness";
import { hasUnsubscribeSignal } from "@/lib/unsubscribe/detect";
import {
  classifyGmailThrownError,
  classifySupabaseError,
} from "@/lib/inbox-load/classify";
import {
  createInboxLoadId,
  elapsedMs,
  logInboxLoadComplete,
  logInboxLoadFailed,
  logInboxLoadStart,
  mergeTimings,
} from "@/lib/inbox-load/diagnostics";
import { inboxLoadUserMessage } from "@/lib/inbox-load/user-messages";
import type {
  InboxLoadDiagnostics,
  InboxLoadFailureReason,
  InboxLoadStage,
  InboxLoadTimings,
} from "@/lib/inbox-load/types";

/** Newest inbox messages fetched per page. */
const INBOX_PAGE_SIZE = 200;

function inboxErrorResponse(
  applyAuthCookies: (r: NextResponse) => NextResponse,
  input: {
    status: number;
    failureReason: InboxLoadFailureReason;
    failureStage: InboxLoadStage;
    message: string;
    diagnostics: InboxLoadDiagnostics;
    gmailStatus?: number | null;
    gmailReason?: string | null;
  },
): NextResponse {
  logInboxLoadFailed({
    ...input.diagnostics,
    failureReason: input.failureReason,
    failureStage: input.failureStage,
    gmailStatus: input.gmailStatus ?? null,
    gmailReason: input.gmailReason ?? null,
  });

  return applyAuthCookies(
    NextResponse.json(
      {
        error: input.failureReason,
        failureReason: input.failureReason,
        failureStage: input.failureStage,
        message: input.message,
        gmailStatus: input.gmailStatus ?? null,
        gmailReason: input.gmailReason ?? null,
        diagnostics: input.diagnostics,
      },
      { status: input.status },
    ),
  );
}

export async function GET(request: Request) {
  const loadId = createInboxLoadId();
  const startedAt = Date.now();
  const pageToken = new URL(request.url).searchParams.get("pageToken");
  const paginated = Boolean(pageToken);

  let timings: InboxLoadTimings = {};
  const baseDiagnostics = (): InboxLoadDiagnostics => ({
    loadId,
    startedAt,
    paginated,
    pageToken,
    timings: { ...timings, totalMs: elapsedMs(startedAt) },
  });

  logInboxLoadStart({ loadId, paginated, pageToken, append: paginated });

  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);

  const authStarted = Date.now();
  const authResult = await requireApiAuth(request, supabase);
  timings = mergeTimings(timings, { authMs: elapsedMs(authStarted) });

  if (!authResult.ok) {
    return inboxErrorResponse(applyAuthCookies, {
      status: authResult.response.status,
      failureReason: "auth_failure",
      failureStage: "auth",
      message: inboxLoadUserMessage("auth_failure"),
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
    const isMissing = googleAuth.response.status === 403;
    return inboxErrorResponse(applyAuthCookies, {
      status: googleAuth.response.status,
      failureReason: isMissing ? "oauth_missing" : "oauth_expired",
      failureStage: "google_token",
      message: inboxLoadUserMessage(isMissing ? "oauth_missing" : "oauth_expired"),
      diagnostics: baseDiagnostics(),
    });
  }

  const accessToken = googleAuth.accessToken;
  const userId = auth.user.id;

  try {
    const listStarted = Date.now();
    const { items, nextPageToken } = await withGoogleAuthRetry(
      userId,
      accessToken,
      (token) =>
        gmailListInboxPage(token, {
          maxResults: INBOX_PAGE_SIZE,
          pageToken,
        }),
    );
    timings = mergeTimings(timings, { gmailListMs: elapsedMs(listStarted) });

    const metaStarted = Date.now();
    const rows = await withGoogleAuthRetry(userId, accessToken, (token) =>
      gmailGetMessagesMetadata(token, items.map((m) => m.id), 25),
    );
    timings = mergeTimings(timings, { gmailMetadataMs: elapsedMs(metaStarted) });
    rows.sort((a, b) => b.internalDateMs - a.internalDateMs);

    const supabaseStarted = Date.now();
    const rulesCtx = userId
      ? await loadCategorizationContext(userId, request)
      : {
          emailOverrides: {},
          emailOverrideRecords: [],
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
    const categorized = await categorizeGmailInboxRows(rows, {
      emailOverrides: rulesCtx.emailOverrides,
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
      const enriched = enrichMessageWithActionIntelligence(withCalendar, {
        category: m.category,
      });
      return {
        ...enriched,
        timelineIntelligence: m.timelineIntelligence,
        relationship: m.relationship,
        hasUnsubscribeSignal: hasUnsubscribeSignal(m.snippet, m.listUnsubscribe),
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
        nextPageToken,
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
    if (gmailClass.reason !== "gmail_api_failure" || /gmail/i.test(String(e))) {
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

    return inboxErrorResponse(applyAuthCookies, {
      status: failureReason === "gmail_rate_limit" ? 429 : 502,
      failureReason,
      failureStage,
      message: inboxLoadUserMessage(failureReason),
      diagnostics: baseDiagnostics(),
      gmailStatus,
      gmailReason,
    });
  }
}
