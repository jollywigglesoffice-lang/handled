import type { SuggestedTimeSlot } from "@/lib/time-impact/types";

type FreeBusyResponse = {
  calendars?: Record<
    string,
    { busy?: Array<{ start: string; end: string }> }
  >;
};

/**
 * Google Calendar freeBusy — returns busy blocks or empty on scope/auth failure.
 */
export async function fetchGoogleCalendarBusyBlocks(
  accessToken: string,
  rangeStart: Date,
  rangeEnd: Date,
  calendarId = "primary",
): Promise<Array<{ start: string; end: string }> | null> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: rangeStart.toISOString(),
      timeMax: rangeEnd.toISOString(),
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    console.warn("[calendar-api] freeBusy failed", res.status);
    return null;
  }

  const data = (await res.json()) as FreeBusyResponse;
  const busy = data.calendars?.[calendarId]?.busy ?? [];
  return busy.map((b) => ({ start: b.start, end: b.end }));
}

type CreateEventInput = {
  accessToken: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timezone?: string;
};

/** Create a tentative calendar hold — user approved via one-tap schedule. */
export async function createGoogleCalendarEvent(
  input: CreateEventInput,
): Promise<{ ok: boolean; eventId?: string; htmlLink?: string }> {
  const tz = input.timezone ?? "UTC";
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start, timeZone: tz },
        end: { dateTime: input.end, timeZone: tz },
        status: "tentative",
      }),
    },
  );

  if (!res.ok) {
    console.warn("[calendar-api] create event failed", res.status);
    return { ok: false };
  }

  const data = (await res.json()) as { id?: string; htmlLink?: string };
  return { ok: true, eventId: data.id, htmlLink: data.htmlLink };
}

export function buildEventSummary(sender: string, subject: string): string {
  const subj = subject.trim().slice(0, 80);
  return subj ? `Meeting: ${sender} — ${subj}` : `Meeting: ${sender}`;
}
