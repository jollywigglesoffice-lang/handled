"use client";

import Link from "next/link";
import { useEmailCompletions } from "@/app/email-completions-context";
import {
  daysWaiting,
  daysWaitingLabel,
  followUpLabel,
  waitingOnLabel,
} from "@/lib/waiting-on/helpers";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";

const COPY = {
  en: {
    waitingOn: "Waiting on",
    resolved: "✓ Resolved",
    stillWaiting: "✓ Still waiting",
  },
  it: {
    waitingOn: "In attesa di",
    resolved: "✓ Risolta",
    stillWaiting: "✓ Ancora in attesa",
  },
} as const;

export function WaitingOnCard({
  record,
  locale,
}: {
  record: EmailCompletionRecord;
  locale: "en" | "it";
}) {
  const { resolveWaiting, markStillWaiting } = useEmailCompletions();
  const t = COPY[locale];
  const days = daysWaiting(record);
  const followUp = followUpLabel(record, locale);
  const who = waitingOnLabel(record, locale);

  return (
    <article className="rounded-xl border border-amber-100 bg-amber-50/30 px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80">
            {t.waitingOn}
          </p>
          <p className="text-lg font-semibold text-[#0F172A]">{who}</p>
          <p className="text-sm font-medium text-amber-900">{daysWaitingLabel(days, locale)}</p>
        </div>
        <Link
          href={`/emails/${encodeURIComponent(record.emailId)}`}
          onClick={() => {
            captureInboxReturnFromOpen(
              { view: "waiting", categoryTab: "all" },
              record.emailId,
            );
          }}
          className="min-w-0 flex-1 text-right"
        >
          <p className="truncate text-sm font-medium text-[#0F172A] hover:text-accent">
            {record.subject || "(no subject)"}
          </p>
          <p className="truncate text-xs text-gray-500">{record.sender}</p>
        </Link>
      </div>

      {followUp ? <p className="mt-2 text-xs text-gray-500">{followUp}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void resolveWaiting(record.emailId)}
          className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
        >
          {t.resolved}
        </button>
        <button
          type="button"
          onClick={() => void markStillWaiting(record.emailId)}
          className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-50"
        >
          {t.stillWaiting}
        </button>
      </div>
    </article>
  );
}
