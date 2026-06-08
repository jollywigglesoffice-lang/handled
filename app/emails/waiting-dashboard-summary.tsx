"use client";

import Link from "next/link";
import type { WaitingDashboardSummary } from "@/lib/waiting-on/metadata-types";

type WaitingDashboardSummaryProps = {
  summary: WaitingDashboardSummary;
  locale: "en" | "it";
  linkToWaiting?: boolean;
  compact?: boolean;
};

const COPY = {
  en: {
    title: "Waiting On",
    total: "Waiting On",
    overdue: "Overdue",
    longest: "Longest Waiting",
    days: "days",
    viewAll: "View all →",
  },
  it: {
    title: "In attesa",
    total: "In attesa",
    overdue: "Scadute",
    longest: "Attesa più lunga",
    days: "giorni",
    viewAll: "Vedi tutte →",
  },
} as const;

export function WaitingDashboardSummary({
  summary,
  locale,
  linkToWaiting = true,
  compact = false,
}: WaitingDashboardSummaryProps) {
  if (summary.total === 0) return null;

  const t = COPY[locale];

  return (
    <section
      className={`rounded-xl border border-[#E2E8F0] bg-white ${
        compact ? "px-4 py-3" : "px-5 py-4 shadow-sm"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#0F172A]">{t.title}</h2>
        {linkToWaiting ? (
          <Link href="/emails/waiting" className="text-xs font-medium text-accent hover:underline">
            {t.viewAll}
          </Link>
        ) : null}
      </div>

      <dl className={`mt-3 flex flex-wrap gap-x-8 gap-y-3 ${compact ? "text-sm" : ""}`}>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.total}</dt>
          <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-[#0F172A]">
            {summary.total}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.overdue}</dt>
          <dd
            className={`mt-0.5 text-2xl font-semibold tabular-nums ${
              summary.overdue > 0 ? "text-red-700" : "text-gray-700"
            }`}
          >
            {summary.overdue}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.longest}</dt>
          <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-gray-700">
            {summary.longestDays}{" "}
            <span className="text-sm font-medium text-gray-500">{t.days}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
