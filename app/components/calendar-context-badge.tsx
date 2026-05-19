"use client";

import Link from "next/link";
import {
  calendarContextBadgeHint,
  calendarContextBadgeLabel,
  readCalendarConnectionState,
} from "@/lib/calendar-awareness";

type CalendarContextBadgeProps = {
  locale?: "en" | "it";
  compact?: boolean;
  showLink?: boolean;
};

export function CalendarContextBadge({
  locale = "en",
  compact,
  showLink = true,
}: CalendarContextBadgeProps) {
  const status = readCalendarConnectionState().status;
  const label = calendarContextBadgeLabel(locale);
  const hint = calendarContextBadgeHint(status, locale);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 font-medium text-sky-900 ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      title={hint}
    >
      <span aria-hidden className="text-sky-600">
        📅
      </span>
      {label}
      {showLink ? (
        <Link
          href="/settings#calendar"
          className="ml-0.5 underline decoration-sky-300 underline-offset-2 hover:text-sky-950"
          onClick={(e) => e.stopPropagation()}
        >
          {locale === "it" ? "Impostazioni" : "Settings"}
        </Link>
      ) : null}
    </span>
  );
}
