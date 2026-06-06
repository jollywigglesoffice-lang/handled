"use client";

import Link from "next/link";
import { useEmailCompletions } from "@/app/email-completions-context";
import {
  receivedLabel,
  repliedLabel,
  waitingOnLabel,
} from "@/lib/waiting-on/helpers";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";

const COPY = {
  en: {
    section: "Response received",
    openReply: "Open reply",
    markResolved: "Mark resolved",
    backToWaiting: "Move back to Waiting On",
  },
  it: {
    section: "Risposta ricevuta",
    openReply: "Apri risposta",
    markResolved: "Segna risolta",
    backToWaiting: "Torna in attesa",
  },
} as const;

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
  const replyId = record.waitingResponseEmailId;

  return (
    <article className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
        {t.section}
      </p>
      <p className="mt-1 text-lg font-semibold text-[#0F172A]">{repliedLabel(record, locale)}</p>
      <p className="text-sm text-gray-600">{receivedLabel(record, locale)}</p>
      <p className="mt-2 truncate text-sm text-gray-500">
        {record.waitingResponseSubject || record.subject || who}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-100/80 pt-3">
        {replyId ? (
          <Link
            href={`/emails/${encodeURIComponent(replyId)}`}
            onClick={() =>
              captureInboxReturnFromOpen({ view: "waiting", categoryTab: "all" }, replyId)
            }
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            {t.openReply}
          </Link>
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
