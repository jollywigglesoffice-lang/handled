import { NextResponse } from "next/server";
import { categorizeGmailInboxRows } from "@/lib/categorize-inbox-messages";
import { stampEmailOverridesOnMessages } from "@/lib/email-overrides/apply-to-messages";

export const dynamic = "force-dynamic";
import { gmailGetMessagesMetadata, gmailListInboxPage } from "@/lib/gmail-api";

/** Newest inbox messages fetched per page. */
const INBOX_PAGE_SIZE = 200;
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

export async function GET(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);

  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const { auth } = authResult;
  const googleAuth = await requireGoogleProviderToken(auth, {
    message: "Sign in with Google to load your Gmail inbox.",
  });
  if (!googleAuth.ok) {
    return applyAuthCookies(googleAuth.response);
  }

  const accessToken = googleAuth.accessToken;

  const pageToken = new URL(request.url).searchParams.get("pageToken");

  try {
    const { items, nextPageToken } = await withGoogleAuthRetry(
      auth.user.id,
      accessToken,
      (token) =>
        gmailListInboxPage(token, {
          maxResults: INBOX_PAGE_SIZE,
          pageToken,
        }),
    );
    const rows = await withGoogleAuthRetry(auth.user.id, accessToken, (token) =>
      gmailGetMessagesMetadata(
        token,
        items.map((m) => m.id),
        25,
      ),
    );
    rows.sort((a, b) => b.internalDateMs - a.internalDateMs);

    const userId = auth.user.id;
    const rulesCtx = userId
      ? await loadCategorizationContext(userId, request)
      : {
          emailOverrides: {},
          emailOverrideRecords: [],
          senderRules: [],
          keywordRules: [],
          allRules: [],
          senderRelationships: [],
        };
    const workflowMode = parseWorkflowModeHeader(
      request.headers.get(WORKFLOW_MODE_HEADER),
    );
    const categorized = await categorizeGmailInboxRows(rows, {
      emailOverrides: rulesCtx.emailOverrides,
      senderRules: rulesCtx.senderRules,
      userRules: rulesCtx.keywordRules,
      senderRelationships: rulesCtx.senderRelationships,
      workflowMode,
    });

    if (process.env.NODE_ENV === "development") {
      const overrideCount = Object.keys(rulesCtx.emailOverrides).length;
      console.log(
        `[api/gmail/messages] ${overrideCount} email override(s), ${rulesCtx.senderRules.length} sender rule(s)`,
      );
      console.log(
        "[api/gmail/messages] sample final categories for UI:",
        categorized.slice(0, 8).map((m) => ({
          id: m.id,
          subject: m.subject?.slice(0, 50),
          category: m.category,
          source: m.categorySource,
          confidence: m.categoryConfidence,
        })),
      );
    }

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
          hasUnsubscribeSignal: hasUnsubscribeSignal(
            m.snippet,
            m.listUnsubscribe,
          ),
        };
      });

    const messagesForClient = stampEmailOverridesOnMessages(
      messages,
      rulesCtx.emailOverrides,
    );

    if (process.env.NODE_ENV === "development") {
      const stamped = messagesForClient.filter((m) => m.categorySource === "manual_override").length;
      if (stamped > 0) {
        console.log(`[api/gmail/messages] stamped ${stamped} manual override(s) onto response`);
      }
    }

    return applyAuthCookies(
      NextResponse.json({
        messages: messagesForClient,
        categoryOverrides: rulesCtx.emailOverrides,
        emailOverrideRecords: rulesCtx.emailOverrideRecords,
        nextPageToken,
      }),
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Gmail request failed";
    console.error("[api/gmail/messages]", e);
    return applyAuthCookies(NextResponse.json({ error: message }, { status: 502 }));
  }
}
