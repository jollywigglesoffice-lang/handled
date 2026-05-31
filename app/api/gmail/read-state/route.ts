import { NextResponse } from "next/server";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReadStateBody = {
  ids?: unknown;
  state?: unknown;
};

export async function POST(request: Request) {
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
    const googleAuth = requireGoogleProviderToken(auth);
    if (!googleAuth.ok) {
      return applyAuthCookies(googleAuth.response);
    }

    const accessToken = auth.providerToken!;

    let body: ReadStateBody;
    try {
      body = (await request.json()) as ReadStateBody;
    } catch {
      return applyAuthCookies(
        NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }),
      );
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const state = body.state;

    if (ids.length === 0) {
      return applyAuthCookies(
        NextResponse.json({ ok: false, error: "No message ids" }, { status: 400 }),
      );
    }
    if (state !== "read" && state !== "unread") {
      return applyAuthCookies(
        NextResponse.json({ ok: false, error: "Invalid state" }, { status: 400 }),
      );
    }

    const { gmailBatchModifyLabels } = await import("@/lib/gmail-api");

    // TEMP DEBUG: trace the outgoing Gmail batchModify request.
    console.log("[DEBUG read-state] →", {
      ids,
      count: ids.length,
      state,
      label: state === "read" ? "remove UNREAD" : "add UNREAD",
      tokenPrefix: accessToken ? `${accessToken.slice(0, 12)}…` : "(none)",
    });

    try {
      // Read  → remove the UNREAD label. Unread → add it back.
      await gmailBatchModifyLabels(
        accessToken,
        ids,
        state === "read" ? { remove: ["UNREAD"] } : { add: ["UNREAD"] },
      );
      console.log("[DEBUG read-state] ✓ Gmail batchModify succeeded");
    } catch (gmailError) {
      const message = gmailError instanceof Error ? gmailError.message : String(gmailError);

      // TEMP DEBUG: parse the exact Gmail status + reason out of the error.
      const statusMatch = message.match(/failed:\s*(\d{3})/);
      const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
      let gmailStatus: string | null = null;
      let gmailReason: string | null = null;
      let gmailMessage: string | null = null;
      const jsonStart = message.indexOf("{");
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(message.slice(jsonStart)) as {
            error?: {
              status?: string;
              message?: string;
              errors?: Array<{ reason?: string }>;
            };
          };
          gmailStatus = parsed.error?.status ?? null;
          gmailMessage = parsed.error?.message ?? null;
          gmailReason = parsed.error?.errors?.[0]?.reason ?? null;
        } catch {
          /* body wasn't JSON */
        }
      }

      console.error("[DEBUG read-state] ✗ Gmail batchModify FAILED", {
        httpStatus,
        gmailStatus,
        gmailReason,
        gmailMessage,
        rawError: message,
      });

      return applyAuthCookies(
        NextResponse.json({ ok: false, error: message }, { status: 502 }),
      );
    }

    return applyAuthCookies(
      NextResponse.json({ ok: true, synced: ids.length, state }),
    );
  } catch (error) {
    console.error("[api/gmail/read-state] route error", error);
    const message = error instanceof Error ? error.message : String(error);
    return applyAuthCookies(
      NextResponse.json({ ok: false, error: message }, { status: 500 }),
    );
  }
}
