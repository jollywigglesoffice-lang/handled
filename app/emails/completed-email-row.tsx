"use client";

import Link from "next/link";
import { EmailLifecycleIndicator } from "@/app/components/email-lifecycle-indicator";
import { inboxCategoryTitle, type InboxCategoryCatalog } from "@/lib/inbox-category-catalog";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";

function formatCompletedDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CompletedEmailRow({
  record,
  locale,
  catalog,
}: {
  record: EmailCompletionRecord;
  locale: "en" | "it";
  catalog: InboxCategoryCatalog;
}) {
  return (
    <Link
      href={`/emails/${encodeURIComponent(record.emailId)}`}
      className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm transition hover:border-accent/30 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#0F172A]">{record.sender || "—"}</p>
        <EmailLifecycleIndicator state="completed" locale={locale} />
      </div>
      <p className="text-sm text-gray-800">{record.subject || "(no subject)"}</p>
      {record.snippet ? (
        <p className="line-clamp-2 text-xs text-gray-500">{record.snippet}</p>
      ) : null}
      <p className="text-xs text-gray-500">
        <span className="font-medium text-emerald-800">✓ {record.actionLabel}</span>
        {" · "}
        {inboxCategoryTitle(record.category, locale, catalog)}
        {" · "}
        {formatCompletedDate(record.completedAt)}
      </p>
    </Link>
  );
}
