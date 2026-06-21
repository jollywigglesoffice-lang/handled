"use client";

import Link from "next/link";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { daysWaitingLabel } from "@/lib/waiting-on/helpers";

type WaitingOnInboxSectionProps = {
  locale: "en" | "it";
  records: EmailCompletionRecord[];
  maxPreview?: number;
};

const COPY = {
  en: {
    title: "Waiting on",
    empty: "Nothing you're waiting on",
    hint: "Use Handled → I'm waiting on someone",
  },
  it: {
    title: "In attesa",
    empty: "Niente in attesa",
    hint: "Usa Gestita → Aspetto qualcuno",
  },
} as const;

/** Workflow state section — outside category tabs, not a category filter. */
export function WaitingOnInboxSection({
  locale,
  records,
  maxPreview = 3,
}: WaitingOnInboxSectionProps) {
  const t = COPY[locale];
  const preview = records.slice(0, maxPreview);

  return (
    <section className="rounded-2xl border border-indigo-100/80 bg-indigo-50/30 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-indigo-950">{t.title}</h2>
          {records.length === 0 ? (
            <p className="mt-0.5 text-xs text-indigo-900/60">{t.hint}</p>
          ) : (
            <p className="mt-0.5 text-xs text-indigo-900/70">
              {records.length === 1
                ? locale === "it"
                  ? "1 risposta in attesa"
                  : "1 reply you're waiting for"
                : locale === "it"
                  ? `${records.length} risposte in attesa`
                  : `${records.length} replies you're waiting for`}
            </p>
          )}
        </div>
      </div>

      {preview.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {preview.map((record) => (
            <li key={record.emailId}>
              <Link
                href={`/emails/${encodeURIComponent(record.emailId)}${record.accountId ? `?accountId=${encodeURIComponent(record.accountId)}` : ""}`}
                className="block rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 transition hover:border-indigo-200"
              >
                <p className="truncate text-sm font-medium text-gray-900">
                  {record.waitingOn?.trim() || record.sender}
                </p>
                <p className="truncate text-xs text-gray-500">{record.subject}</p>
                <p className="mt-0.5 text-xs text-indigo-700/80">
                  {daysWaitingLabel(Math.max(0, Math.floor((Date.now() - (record.stillWaitingAt ?? record.completedAt)) / 86400000)), locale)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
