import type { SuggestedTimeSlot } from "@/lib/time-impact/types";

const SLOT_DURATION_MS = 30 * 60 * 1000;
const SLOT_STEP_MS = 30 * 60 * 1000;

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function formatSlotLabel(start: Date, end: Date, locale: "en" | "it"): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let dayLabel: string;
  if (start.toDateString() === now.toDateString()) {
    dayLabel = locale === "it" ? "Oggi" : "Today";
  } else if (start.toDateString() === tomorrow.toDateString()) {
    dayLabel = locale === "it" ? "Domani" : "Tomorrow";
  } else {
    dayLabel = start.toLocaleDateString(locale === "it" ? "it-IT" : "en-US", {
      weekday: "long",
    });
  }

  const timeFmt = (d: Date) =>
    d.toLocaleTimeString(locale === "it" ? "it-IT" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `${dayLabel} ${timeFmt(start)}–${timeFmt(end)}`;
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function slotIsFree(
  startMs: number,
  endMs: number,
  busyBlocks: Array<{ start: string; end: string }>,
): boolean {
  return !busyBlocks.some((b) =>
    overlaps(startMs, endMs, new Date(b.start).getTime(), new Date(b.end).getTime()),
  );
}

function alignToNextStep(from: Date): Date {
  const d = new Date(from);
  const ms = SLOT_STEP_MS;
  const aligned = Math.ceil(d.getTime() / ms) * ms;
  return new Date(aligned);
}

/**
 * Find free windows verified against Google Calendar freeBusy blocks only.
 * No work-hour heuristics — a slot is free iff it does not overlap API busy data.
 */
export function findFreeTimeSlots(
  busyBlocks: Array<{ start: string; end: string }>,
  count = 3,
  locale: "en" | "it" = "en",
  rangeStart = new Date(),
  rangeEnd?: Date,
): Array<{ id: string; start: string; end: string; label: string }> {
  const end = rangeEnd ?? new Date(rangeStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  const slots: Array<{ id: string; start: string; end: string; label: string }> = [];
  let cursor = alignToNextStep(rangeStart);

  while (slots.length < count && cursor < end) {
    const slotEnd = new Date(cursor.getTime() + SLOT_DURATION_MS);
    if (slotEnd > end) break;

    if (slotIsFree(cursor.getTime(), slotEnd.getTime(), busyBlocks)) {
      const id = `free_${slots.length}_${cursor.getTime()}`;
      slots.push({
        id,
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
        label: formatSlotLabel(cursor, slotEnd, locale),
      });
      cursor = new Date(cursor.getTime() + 90 * 60 * 1000);
    } else {
      cursor = new Date(cursor.getTime() + SLOT_STEP_MS);
    }
  }

  return slots;
}

/** Find the next free window after a conflicting slot — still verified against busy blocks. */
export function findNextFreeAlternative(
  conflictStart: string,
  busyBlocks: Array<{ start: string; end: string }>,
  locale: "en" | "it" = "en",
  rangeEnd?: Date,
): { start: string; end: string; label: string } | null {
  const after = new Date(conflictStart);
  after.setMinutes(after.getMinutes() + 30);
  const end = rangeEnd ?? new Date(after.getTime() + 7 * 24 * 60 * 60 * 1000);
  const found = findFreeTimeSlots(busyBlocks, 1, locale, after, end);
  return found[0] ?? null;
}

export function detectSlotConflicts(
  slots: Array<{ start: string; end: string; id: string; label: string }>,
  busyBlocks: Array<{ start: string; end: string }>,
  locale: "en" | "it" = "en",
): SuggestedTimeSlot[] {
  return slots.map((slot) => {
    const s = new Date(slot.start).getTime();
    const e = new Date(slot.end).getTime();
    const conflict = busyBlocks.some((b) =>
      overlaps(s, e, new Date(b.start).getTime(), new Date(b.end).getTime()),
    );

    let alternativeStart: string | undefined;
    let alternativeEnd: string | undefined;
    let alternativeLabel: string | undefined;

    if (conflict) {
      const alt = findNextFreeAlternative(slot.start, busyBlocks, locale);
      if (alt) {
        alternativeStart = alt.start;
        alternativeEnd = alt.end;
        alternativeLabel = alt.label;
      }
    }

    return {
      id: slot.id,
      start: slot.start,
      end: slot.end,
      label: slot.label,
      hasConflict: conflict,
      alternativeStart,
      alternativeEnd,
      alternativeLabel,
    };
  });
}

/** Only returns slots when calendar freeBusy succeeded — never synthetic placeholders. */
export function buildSuggestedSlots(
  busyBlocks: Array<{ start: string; end: string }>,
  locale: "en" | "it" = "en",
  calendarDataAvailable = false,
  count = 3,
): SuggestedTimeSlot[] {
  if (!calendarDataAvailable) {
    return [];
  }

  const raw = findFreeTimeSlots(busyBlocks, count, locale);
  return detectSlotConflicts(raw, busyBlocks, locale);
}

export function getCalendarTimezone(): string {
  return localTimezone();
}

export function draftSchedulingReply(
  slot: SuggestedTimeSlot,
  locale: "en" | "it",
  mode: "accept" | "propose" = "accept",
): string {
  if (locale === "it") {
    return mode === "propose"
      ? `Propongo ${slot.label} — ti va bene?`
      : `Perfetto — ${slot.label} va bene per me. Confermi?`;
  }
  return mode === "propose"
    ? `I'd like to propose ${slot.label} — does that work for you?`
    : `That works for me — ${slot.label}. Does that time work on your end?`;
}
