"use client";

import Link from "next/link";
import { WaitingOnQuickActions } from "@/app/emails/waiting-on-quick-actions";
import { useWaitingOnMetadata } from "@/app/waiting-on-metadata-context";
import {
  buildWaitingDashboardItem,
  followUpDueLabel,
  workflowStatusLabel,
} from "@/lib/waiting-on/dashboard";
import { daysWaitingLabel, formatWaitingSinceDate } from "@/lib/waiting-on/helpers";
import { waitingUrgencyStyle } from "@/lib/waiting-on/urgency";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { lookupScopedValue } from "@/lib/gmail/account-types";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";
import { AccountBadge } from "@/app/emails/account-badge";

const COPY = {
  en: {
    waitingSince: "Waiting Since",
    daysWaiting: "Days Waiting",
    followUpDate: "Follow-Up Date",
    status: "Status",
    urgent: "Urgent",
    openEmail: "Open email",
  },
  it: {
    waitingSince: "In attesa dal",
    daysWaiting: "Giorni di attesa",
    followUpDate: "Data follow-up",
    status: "Stato",
    urgent: "Urgente",
    openEmail: "Apri email",
  },
} as const;

export function WaitingOnCard({
  record,
  locale,
}: {
  record: EmailCompletionRecord;
  locale: "en" | "it";
}) {
  const { metadata } = useWaitingOnMetadata();
  const meta = lookupScopedValue(metadata, record.emailId, record.accountId);
  const item = buildWaitingDashboardItem(record, meta, locale);
  const urgency = waitingUrgencyStyle(item.daysWaiting);
  const followUpDue = followUpDueLabel(item.followUpAt, locale);
  const sinceDate = formatWaitingSinceDate(record, locale);

  return (
    <article
      className={`rounded-xl border border-[#E2E8F0] border-l-4 bg-white px-4 py-4 shadow-sm ${urgency.borderClass} ${urgency.bgClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {record.accountLabel ? <AccountBadge label={record.accountLabel} /> : null}
            <h3 className="text-lg font-semibold text-[#0F172A]">{item.waitingOn}</h3>
            {item.isUrgent ? (
              <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">
                {COPY[locale].urgent}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-gray-700">{item.subject}</p>
          {item.sender ? (
            <p className="mt-0.5 truncate text-xs text-gray-500">{item.sender}</p>
          ) : null}
        </div>

        <Link
          href={
            record.accountId
              ? `/emails/${encodeURIComponent(record.emailId)}?accountId=${encodeURIComponent(record.accountId)}`
              : `/emails/${encodeURIComponent(record.emailId)}`
          }
          onClick={() => {
            captureInboxReturnFromOpen(
              { view: "inbox", categoryTab: "all" },
              record.emailId,
            );
          }}
          className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover"
        >
          {COPY[locale].openEmail}
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {COPY[locale].waitingSince}
          </dt>
          <dd className="mt-0.5 text-gray-700">{sinceDate || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {COPY[locale].daysWaiting}
          </dt>
          <dd className={`mt-0.5 font-semibold tabular-nums ${urgency.timerClass}`}>
            {daysWaitingLabel(item.daysWaiting, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {COPY[locale].followUpDate}
          </dt>
          <dd className="mt-0.5 text-gray-700">{followUpDue ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {COPY[locale].status}
          </dt>
          <dd className="mt-1">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${urgency.statusClass}`}
            >
              {workflowStatusLabel(item.workflowStatus, locale)}
            </span>
          </dd>
        </div>
      </dl>

      <WaitingOnQuickActions record={record} note={item.note} locale={locale} />
    </article>
  );
}
