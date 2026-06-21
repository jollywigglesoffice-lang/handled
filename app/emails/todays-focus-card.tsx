"use client";

import Link from "next/link";
import {
  buildFocusInsightLine,
  buildHandledElsewhereLine,
  type InboxModeLocale,
} from "@/lib/inbox-modes";

export type FocusEmailPreview = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  accountId?: string;
};

type TodaysFocusCardProps = {
  locale: InboxModeLocale;
  focusEmails: FocusEmailPreview[];
  attentionCount: number;
  handledElsewhereCount: number;
};

const COPY = {
  en: {
    today: "Today",
    focus: "Worth your attention",
    viewAll: "View all",
  },
  it: {
    today: "Oggi",
    focus: "Da vedere",
    viewAll: "Vedi tutte",
  },
} as const;

export function TodaysFocusCard({
  locale,
  focusEmails,
  attentionCount,
  handledElsewhereCount,
}: TodaysFocusCardProps) {
  const t = COPY[locale];
  const insight = buildFocusInsightLine(attentionCount, locale);
  const handledLine = buildHandledElsewhereLine(handledElsewhereCount, locale);

  return (
    <section className="space-y-5 py-1">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-400">{t.today}</p>
        <p className="text-[15px] leading-relaxed text-gray-700">{insight}</p>
        <p className="text-sm text-gray-400">{handledLine}</p>
      </div>

      {focusEmails.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-gray-400">{t.focus}</p>
          <ul className="divide-y divide-gray-100/80">
            {focusEmails.map((email) => (
              <FocusEmailRow key={email.id} email={email} locale={locale} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function FocusEmailRow({
  email,
  locale,
}: {
  email: FocusEmailPreview;
  locale: InboxModeLocale;
}) {
  const href = (() => {
    const base = `/emails/${encodeURIComponent(email.id)}`;
    return email.accountId
      ? `${base}?accountId=${encodeURIComponent(email.accountId)}`
      : base;
  })();

  return (
    <li>
      <Link
        href={href}
        className="group -mx-2 flex flex-col gap-0.5 rounded-lg px-2 py-3 transition hover:bg-gray-50/80"
      >
        <span className="text-sm font-medium text-gray-900 transition group-hover:text-gray-700">
          {email.subject || (locale === "it" ? "(nessun oggetto)" : "(no subject)")}
        </span>
        <span className="text-xs text-gray-400">
          {email.sender}
          {email.snippet ? (
            <>
              <span className="mx-1.5 text-gray-300" aria-hidden>
                ·
              </span>
              <span className="text-gray-400">{truncate(email.snippet, 72)}</span>
            </>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
