"use client";

import Link from "next/link";
import { useEmailCompletions } from "@/app/email-completions-context";
import {
  WaitingFollowUpBadge,
  WaitingFollowUpPanel,
} from "@/app/emails/waiting-follow-up-panel";
import { detectWaitingFollowUp } from "@/lib/waiting-on/follow-up-detect";
import {
  daysWaiting,
  daysWaitingLabel,
  startedOnLabel,
  waitingOnLabel,
} from "@/lib/waiting-on/helpers";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import type { WaitingResolutionReason } from "@/lib/waiting-on/types";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";

const COPY = {
  en: {
    waitingOn: "Waiting on",
    receivedResponse: "✓ Received response",
    noLongerWaiting: "✓ No longer waiting",
    openEmail: "Open email",
  },
  it: {
    waitingOn: "In attesa di",
    receivedResponse: "✓ Risposta ricevuta",
    noLongerWaiting: "✓ Non più in attesa",
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
  const { resolveWaiting } = useEmailCompletions();
  const t = COPY[locale];
  const days = daysWaiting(record);
  const who = waitingOnLabel(record, locale);
  const started = startedOnLabel(record, locale);
  const followUp = detectWaitingFollowUp(record);

  function handleResolve(reason: WaitingResolutionReason) {
    void resolveWaiting(record.emailId, reason, locale);
  }

  return (
    <article className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-[#0F172A]">
              {locale === "it" ? `${t.waitingOn} ${who}` : `${t.waitingOn} ${who}`}
            </p>
            {followUp.mayNeedFollowUp ? <WaitingFollowUpBadge locale={locale} /> : null}
          </div>
          <p className="text-sm font-medium text-gray-700">{daysWaitingLabel(days, locale)}</p>
          {started ? <p className="text-xs text-gray-400">{started}</p> : null}
        </div>
        <Link
          href={`/emails/${encodeURIComponent(record.emailId)}`}
          onClick={() => {
            captureInboxReturnFromOpen(
              { view: "waiting", categoryTab: "all" },
              record.emailId,
            );
          }}
          className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover"
        >
          {t.openEmail}
        </Link>
      </div>

      <p className="mt-3 truncate text-sm text-gray-500">
        {record.subject || "(no subject)"}
        {record.sender ? ` · ${record.sender}` : ""}
      </p>

      {followUp.mayNeedFollowUp ? (
        <WaitingFollowUpPanel
          record={record}
          locale={locale}
          showSuggestion
          compact
        />
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[#F1F5F9] pt-3">
        <button
          type="button"
          onClick={() => handleResolve("received_response")}
          className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
        >
          {t.receivedResponse}
        </button>
        <button
          type="button"
          onClick={() => handleResolve("no_longer_waiting")}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          {t.noLongerWaiting}
        </button>
      </div>
    </article>
  );
}
