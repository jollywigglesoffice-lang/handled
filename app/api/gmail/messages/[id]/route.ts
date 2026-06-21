import { NextResponse } from "next/server";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { withGoogleAuthRetry } from "@/lib/google/google-access-token";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";
import { parseWorkflowMode, WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";
import {
  buildEmailDetailFromGmailMessage,
  buildEmailDetailFromGmailMetadata,
  emailDetailHasDisplayContent,
  ensureMinimumEmailDetail,
} from "@/lib/email-detail-from-gmail";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId ?? "").trim();

  if (!id) {
    return NextResponse.json({ found: false, error: "Missing id" }, { status: 400 });
  }

  let applyAuthCookies: (response: NextResponse) => NextResponse = (r) => r;

  try {
    const routeSupabase = createRouteHandlerSupabase(request);
    applyAuthCookies = routeSupabase.applyAuthCookies;
    const { supabase } = routeSupabase;

    const authResult = await requireApiAuth(request, supabase);
    if (!authResult.ok) {
      return applyAuthCookies(authResult.response);
    }

    const { auth } = authResult;
    const accountId = new URL(request.url).searchParams.get("accountId");
    const googleAuth = await requireGoogleProviderToken(auth, { accountId });
    if (!googleAuth.ok) {
      console.error("[api/gmail/messages/[id]] google token unavailable", {
        messageId: id,
        accountId,
        userId: auth.user.id,
      });
      return applyAuthCookies(googleAuth.response);
    }

    const accessToken = googleAuth.accessToken;
    const workflowMode = parseWorkflowMode(request.headers.get(WORKFLOW_MODE_HEADER));

    const { gmailGetMessageFull } = await import("@/lib/gmail-api");

    let msg;
    try {
      msg = await withGoogleAuthRetry(
        auth.user.id,
        accessToken,
        (token) => gmailGetMessageFull(token, id),
        { accountId },
      );
    } catch (gmailError) {
      console.error("[api/gmail/messages/[id]] gmail fetch failed", {
        messageId: id,
        accountId,
        error: gmailError,
      });
      const message = gmailError instanceof Error ? gmailError.message : String(gmailError);
      const notFound =
        message.includes("404") ||
        message.toLowerCase().includes("not found") ||
        message.includes("Requested entity was not found");
      if (notFound) {
        return applyAuthCookies(
          NextResponse.json({ found: false, error: "Email not found" }, { status: 404 }),
        );
      }
      return applyAuthCookies(
        NextResponse.json({ found: false, error: message }, { status: 502 }),
      );
    }

    if (!msg?.id) {
      console.error("[api/gmail/messages/[id]] gmail returned empty message", {
        messageId: id,
        accountId,
      });
      return applyAuthCookies(
        NextResponse.json({ found: false, error: "Email not found" }, { status: 404 }),
      );
    }

    try {
      const email = ensureMinimumEmailDetail(
        await buildEmailDetailFromGmailMessage(
          msg,
          auth.user.id,
          workflowMode,
          { accountId: accountId ?? undefined },
        ),
      );

      if (!emailDetailHasDisplayContent(email)) {
        console.error("[api/gmail/messages/[id]] email missing display content after enrichment", {
          messageId: id,
          accountId,
          sender: email.sender,
          subject: email.subject,
          bodyLength: (email.bodyPlain ?? email.body ?? "").length,
          snippetLength: email.summary?.length ?? 0,
        });
        return applyAuthCookies(
          NextResponse.json(
            {
              found: false,
              error: "email_content_empty",
              reason: "body_and_snippet_missing",
            },
            { status: 502 },
          ),
        );
      }

      return applyAuthCookies(
        NextResponse.json({ found: true, email, enriched: true }),
      );
    } catch (enrichError) {
      console.error("[api/gmail/messages/[id]] enrichment failed, metadata fallback", {
        messageId: id,
        accountId,
        error: enrichError,
      });
      try {
        const email = ensureMinimumEmailDetail(
          await buildEmailDetailFromGmailMetadata(
            accessToken,
            id,
            auth.user.id,
            workflowMode,
            { accountId: accountId ?? undefined },
          ),
        );

        if (!emailDetailHasDisplayContent(email)) {
          console.error("[api/gmail/messages/[id]] metadata fallback still empty", {
            messageId: id,
            accountId,
          });
          return applyAuthCookies(
            NextResponse.json(
              {
                found: false,
                error: "email_content_empty",
                reason: "metadata_fallback_empty",
              },
              { status: 502 },
            ),
          );
        }

        return applyAuthCookies(
          NextResponse.json({
            found: true,
            email,
            enriched: true,
            enrichmentDegraded: true,
          }),
        );
      } catch (metaError) {
        console.error("[api/gmail/messages/[id]] metadata fallback failed", {
          messageId: id,
          accountId,
          error: metaError,
        });
        const message = metaError instanceof Error ? metaError.message : String(metaError);
        return applyAuthCookies(
          NextResponse.json({ found: false, error: message }, { status: 502 }),
        );
      }
    }
  } catch (error) {
    console.error("[api/gmail/messages/[id]] route error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return applyAuthCookies(
      NextResponse.json(
        { found: false, error: message, routeError: true },
        { status: 500 },
      ),
    );
  }
}
