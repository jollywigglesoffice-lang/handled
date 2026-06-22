import { NextResponse } from "next/server";
import { categorizeGmailInboxRows, loadCategorizationContext } from "@/lib/domain/categorization";
import { stampEmailOverridesOnMessages } from "@/lib/email-overrides/apply-to-messages";
import { listConnectedGmailAccounts } from "@/lib/google/connected-accounts";
import { fetchUnifiedGmailSearch } from "@/lib/gmail/fetch-unified-inbox";
import { buildGmailSearchQuery } from "@/lib/inbox-search/query";
import { INBOX_SEARCH_MAX_RESULTS } from "@/lib/inbox-search/constants";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";
import { parseWorkflowModeHeader } from "@/lib/workflow-mode-effects";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";
import { handledErrorFromInboxFailure } from "@/lib/handled-errors";

function searchErrorResponse(
  applyAuthCookies: (r: NextResponse) => NextResponse,
  failureReason: Parameters<typeof handledErrorFromInboxFailure>[0],
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  const structured = handledErrorFromInboxFailure(failureReason);
  return applyAuthCookies(
    NextResponse.json(
      {
        error: structured.code,
        failureReason: structured.code,
        code: structured.code,
        category: structured.category,
        userMessage: structured.userMessage,
        actionLabel: structured.actionLabel,
        action: structured.action,
        title: structured.title,
        messages: [],
        ...extra,
      },
      { status },
    ),
  );
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const userQuery = searchParams.get("q")?.trim() ?? "";
  const read = searchParams.get("read");
  const readFilter =
    read === "unread" || read === "read" ? read : ("all" as const);
  const accountFilterId = searchParams.get("accountId");

  if (!userQuery) {
    return NextResponse.json({ messages: [], query: "" });
  }

  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const googleAuth = await requireGoogleProviderToken(authResult.auth, {
    message: "Sign in with Google to search your Gmail.",
  });
  if (!googleAuth.ok) {
    return searchErrorResponse(applyAuthCookies, "auth_error", 401);
  }

  const userId = authResult.auth.user.id;

  try {
    const accounts = await listConnectedGmailAccounts(userId, authResult.auth.user.email);
    if (accounts.length === 0) {
      return searchErrorResponse(applyAuthCookies, "missing_account", 403);
    }

    const gmailQuery = buildGmailSearchQuery(userQuery, readFilter);
    const { rows } = await fetchUnifiedGmailSearch({
      userId,
      accounts,
      accountFilterId,
      gmailQuery,
      maxResults: INBOX_SEARCH_MAX_RESULTS,
    });

    const rulesCtx = await loadCategorizationContext(userId, request);
    const workflowMode = parseWorkflowModeHeader(
      request.headers.get(WORKFLOW_MODE_HEADER),
    );

    const categorized = await categorizeGmailInboxRows(rows, {
      emailOverrides: rulesCtx.emailOverrides,
      memoryRules: rulesCtx.memoryRules,
      senderRules: rulesCtx.senderRules,
      userRules: rulesCtx.keywordRules,
      senderRelationships: rulesCtx.senderRelationships,
      workflowMode,
      categoryCatalog: rulesCtx.categoryCatalog,
    });

    const messagesForClient = stampEmailOverridesOnMessages(
      categorized,
      rulesCtx.emailOverrides,
    );

    return applyAuthCookies(
      NextResponse.json({
        messages: messagesForClient,
        query: userQuery,
        gmailQuery,
        accountsSearched: accountFilterId
          ? accounts.filter((a) => a.id === accountFilterId).length
          : accounts.length,
      }),
    );
  } catch (e) {
    console.error("[api/gmail/search]", e);
    return searchErrorResponse(applyAuthCookies, "gmail_fetch_failed", 502);
  }
}
