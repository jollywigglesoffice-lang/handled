"use client";

import Link from "next/link";
import { useEmailCompletions } from "@/app/email-completions-context";
import {
  receivedRelativeLabel,
  repliedLabel,
  responsePersonLabel,
  responseReceivedHeadline,
  waitingOnLabel,
} from "@/lib/waiting-on/helpers";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";
import { trackEvent } from "@/lib/analytics";

const COPY = {
  en: {
    openReply: "Open reply",
    openConversation: "Open conversation",
    markResolved: "Mark resolved",
    backToWaiting: "Return to Waiting On",
    repliedBy: "Replied by",
    waitingOn: "Waiting on",
  },
  it: {
    openReply: "Apri risposta",
    openConversation: "Apri conversazione",
    markResolved: "Segna risolta",
    backToWaiting: "Torna in attesa",
    repliedBy: "Risposta da",
    waitingOn: "In attesa di",
  },
} as const;

function trackResponseOpened(
  record: EmailCompletionRecord,
  source: "waiting_view" | "waiting_view_conversation",
) {
  trackEvent("response_received_opened", {
    waiting_email_id: record.emailId,
    response_email_id: record.waitingResponseEmailId ?? null,
    waiting_on: record.waitingOn ?? null,
    thread_id: record.threadId ?? null,
    source,
  });
}

export function WaitingResponseCard({
  record,
  locale,
}: {
  record: EmailCompletionRecord;
  locale: "en" | "it";
}) {
  const { resolveWaiting, dismissWaitingResponse } = useEmailCompletions();
  const t = COPY[locale];
  const who = waitingOnLabel(record, locale);
  const person = responsePersonLabel(record);
  const replyId = record.waitingResponseEmailId;
  const when = receivedRelativeLabel(record, locale);

  return (
    <article className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-4 shadow-sm">
      <p className="text-sm font-semibold text-emerald-900">{responseReceivedHeadline(locale)}</p>
      <p className="mt-1 text-lg font-semibold text-[#0F172A]">{repliedLabel(record, locale)}</p>
      {when ? <p className="text-sm text-gray-600">{when}</p> : null}

      <dl className="mt-3 space-y-1 text-sm text-gray-600">
        {person ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-gray-500">{t.repliedBy}</dt>
            <dd>{person}</dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-gray-500">{t.waitingOn}</dt>
          <dd>{who}</dd>
        </div>
      </dl>

      <p className="mt-2 truncate text-sm text-gray-500">
        {record.waitingResponseSubject || record.subject}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-100/80 pt-3">
        {replyId ? (
          <>
            <Link
              href={`/emails/${encodeURIComponent(replyId)}`}
              onClick={() => {
                trackResponseOpened(record, "waiting_view");
                captureInboxReturnFromOpen({ view: "inbox", categoryTab: "all" }, replyId);
              }}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              {t.openReply}
            </Link>
            <Link
              href={`/emails/${encodeURIComponent(replyId)}`}
              onClick={() => {
                trackResponseOpened(record, "waiting_view_conversation");
                captureInboxReturnFromOpen({ view: "inbox", categoryTab: "all" }, replyId);
              }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {t.openConversation}
            </Link>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => void resolveWaiting(record.emailId, "received_response", locale)}
          className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
        >
          {t.markResolved}
        </button>
        <button
          type="button"
          onClick={() => void dismissWaitingResponse(record.emailId)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          {t.backToWaiting}
        </button>
      </div>
    </article>
  );
}
