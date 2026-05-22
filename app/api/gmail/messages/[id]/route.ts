import { NextResponse } from "next/server";
import {
  buildEmailDetailFromGmailMessage,
  buildEmailDetailFromGmailMetadata,
  resolveEmailDetailWorkflowMode,
} from "@/lib/email-detail-from-gmail";
import { gmailGetMessageFull } from "@/lib/gmail-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKFLOW_MODE_HEADER } from "@/lib/workflow-mode";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId ?? "").trim();

  if (!id) {
    return NextResponse.json({ found: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[api/gmail/messages/[id]] getSession error", sessionError);
    }

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", authRequired: true },
        { status: 401 },
      );
    }

    const accessToken = session.provider_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: "missing_google_token", authRequired: true, reason: "connect_gmail" },
        { status: 403 },
      );
    }

    const workflowMode = resolveEmailDetailWorkflowMode(
      undefined,
      request.headers.get(WORKFLOW_MODE_HEADER),
    );

    let msg;
    try {
      msg = await gmailGetMessageFull(accessToken, id);
    } catch (gmailError) {
      console.error("EMAIL DETAIL LOAD ERROR:", gmailError);
      const message = gmailError instanceof Error ? gmailError.message : String(gmailError);
      const notFound =
        message.includes("404") ||
        message.toLowerCase().includes("not found") ||
        message.includes("Requested entity was not found");
      if (notFound) {
        return NextResponse.json({ found: false, error: "Email not found" }, { status: 404 });
      }
      return NextResponse.json({ found: false, error: message }, { status: 502 });
    }

    if (!msg?.id) {
      return NextResponse.json({ found: false, error: "Email not found" }, { status: 404 });
    }

    try {
      const email = await buildEmailDetailFromGmailMessage(
        msg,
        session.user.id,
        workflowMode,
      );
      return NextResponse.json({ found: true, email, enriched: true });
    } catch (enrichError) {
      console.error("[api/gmail/messages/[id]] enrichment failed, metadata fallback", enrichError);
      try {
        const email = await buildEmailDetailFromGmailMetadata(
          accessToken,
          id,
          session.user.id,
          workflowMode,
        );
        return NextResponse.json({
          found: true,
          email,
          enriched: true,
          enrichmentDegraded: true,
        });
      } catch (metaError) {
        console.error("EMAIL DETAIL LOAD ERROR:", metaError);
        const message = metaError instanceof Error ? metaError.message : String(metaError);
        return NextResponse.json({ found: false, error: message }, { status: 502 });
      }
    }
  } catch (error) {
    console.error("EMAIL DETAIL LOAD ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ found: false, error: message }, { status: 500 });
  }
}
