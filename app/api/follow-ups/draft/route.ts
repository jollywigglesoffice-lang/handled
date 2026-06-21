import { NextResponse } from "next/server";
import { generateFollowUpDraft } from "@/lib/follow-up/draft";
import { parseConversationState } from "@/lib/follow-up-reminders/storage";
import type { ConversationState } from "@/lib/follow-up/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  let body: {
    sender?: string;
    subject?: string;
    snippet?: string;
    state?: string;
    userName?: string;
    relationship?: {
      kind?: string;
      label?: string;
      importance?: string;
      source?: string;
      confidence?: number;
    };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const state: ConversationState = body.state
    ? parseConversationState(body.state)
    : "follow_up_recommended";

  const relationship = parseRelationshipBody(body.relationship);

  const draft = await generateFollowUpDraft({
    row: {
      sender: body.sender ?? "",
      subject: body.subject ?? "",
      snippet: body.snippet ?? "",
    },
    state,
    userName: body.userName,
    relationship,
  });

  return applyAuthCookies(NextResponse.json({ draft }));
}

function parseRelationshipBody(
  raw: {
    kind?: string;
    label?: string;
    importance?: string;
    source?: string;
    confidence?: number;
  } | undefined,
): SenderRelationshipProfile | null {
  if (!raw?.kind) return null;
  const kinds = new Set([
    "family",
    "friends",
    "school",
    "healthcare",
    "vip_client",
    "client",
    "team",
    "billing",
    "newsletters",
    "promotions",
    "marketing",
    "unknown",
  ]);
  if (!kinds.has(raw.kind)) return null;
  return {
    kind: raw.kind as SenderRelationshipProfile["kind"],
    label: (raw.label as SenderRelationshipProfile["label"]) ?? "Client",
    importance:
      raw.importance === "vip" ||
      raw.importance === "important" ||
      raw.importance === "ignore"
        ? raw.importance
        : "normal",
    source:
      raw.source === "manual" || raw.source === "detected" || raw.source === "domain"
        ? raw.source
        : "detected",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
  };
}
