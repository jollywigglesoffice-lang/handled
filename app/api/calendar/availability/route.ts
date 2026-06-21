import { NextResponse } from "next/server";
import {
  buildSuggestedSlots,
  getCalendarTimezone,
} from "@/lib/calendar-awareness/slots";
import { fetchGoogleCalendarBusyBlocks } from "@/lib/google/calendar-api";
import { requireApiAuth, requireGoogleProviderToken } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

/** Real availability from Google Calendar freeBusy — never synthetic slots. */
export async function GET(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "it" ? "it" : "en";
  const accountId = url.searchParams.get("accountId");
  const slotCount = Math.min(20, Math.max(1, Number(url.searchParams.get("count") ?? 3) || 3));

  const rangeStart = new Date();
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 14);

  const tokenResult = await requireGoogleProviderToken(authResult.auth, {
    accountId,
  });

  if (!tokenResult.ok) {
    return applyAuthCookies(
      NextResponse.json({
        timezone: getCalendarTimezone(),
        slots: [],
        busyBlocks: [],
        calendarConnected: false,
        calendarApiError: false,
      }),
    );
  }

  const busy = await fetchGoogleCalendarBusyBlocks(
    tokenResult.accessToken,
    rangeStart,
    rangeEnd,
  );

  if (busy === null) {
    return applyAuthCookies(
      NextResponse.json({
        timezone: getCalendarTimezone(),
        slots: [],
        busyBlocks: [],
        calendarConnected: true,
        calendarApiError: true,
      }),
    );
  }

  const slots = buildSuggestedSlots(busy, locale, true, slotCount);

  return applyAuthCookies(
    NextResponse.json({
      timezone: getCalendarTimezone(),
      slots,
      busyBlocks: busy,
      calendarConnected: true,
      calendarApiError: false,
    }),
  );
}
