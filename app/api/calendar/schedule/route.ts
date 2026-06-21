import { NextResponse } from "next/server";
import { draftSchedulingReply } from "@/lib/calendar-awareness/slots";
import {
  buildEventSummary,
  createGoogleCalendarEvent,
} from "@/lib/google/calendar-api";
import { getCalendarTimezone } from "@/lib/calendar-awareness/slots";
import type { SuggestedTimeSlot } from "@/lib/time-impact/types";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

type ScheduleBody = {
  slot?: SuggestedTimeSlot;
  sender?: string;
  subject?: string;
  emailId?: string;
  locale?: "en" | "it";
  accountId?: string;
  useAlternative?: boolean;
  proposeMode?: "accept" | "propose";
};

/** One-tap schedule acceptance — creates tentative calendar hold when permitted. */
export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  let body: ScheduleBody;
  try {
    body = (await request.json()) as ScheduleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slot = body.slot;
  if (!slot?.start || !slot.end) {
    return NextResponse.json({ error: "slot required" }, { status: 400 });
  }

  const locale = body.locale === "it" ? "it" : "en";
  const effectiveSlot: SuggestedTimeSlot = body.useAlternative &&
    slot.alternativeStart &&
    slot.alternativeEnd
    ? {
        ...slot,
        start: slot.alternativeStart,
        end: slot.alternativeEnd,
        label: slot.alternativeLabel ?? slot.label,
        hasConflict: false,
      }
    : slot;

  const draftReplySnippet = draftSchedulingReply(
    effectiveSlot,
    locale,
    body.proposeMode === "propose" ? "propose" : "accept",
  );
  let calendarEventCreated = false;
  let calendarEventId: string | null = null;
  let calendarEventLink: string | null = null;
  let message =
    locale === "it"
      ? "Orario approvato — bozza di risposta pronta."
      : "Time approved — draft reply ready.";

  const tokenResult = await requireGoogleProviderToken(authResult.auth, {
    accountId: body.accountId,
  });
  if (tokenResult.ok) {
    const summary = buildEventSummary(body.sender ?? "Contact", body.subject ?? "Meeting");
    const created = await createGoogleCalendarEvent({
      accessToken: tokenResult.accessToken,
      summary,
      description: `Scheduled from Handled (email ${body.emailId ?? "—"}).\n\nDraft reply:\n${draftReplySnippet}`,
      start: effectiveSlot.start,
      end: effectiveSlot.end,
      timezone: getCalendarTimezone(),
    });
    if (created.ok) {
      calendarEventCreated = true;
      calendarEventId = created.eventId ?? null;
      calendarEventLink = created.htmlLink ?? null;
      message =
        locale === "it"
          ? "Aggiunto al calendario come provvisorio — tu approvi prima di inviare."
          : "Added to your calendar as tentative — you approve before anything is sent.";
    }
  }

  return applyAuthCookies(
    NextResponse.json({
      ok: true,
      slot: effectiveSlot,
      draftReplySnippet,
      calendarEventCreated,
      calendarEventId,
      calendarEventLink,
      message,
    }),
  );
}
