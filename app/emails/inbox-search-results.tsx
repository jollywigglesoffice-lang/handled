"use client";

import { GmailInboxCard } from "@/app/emails/gmail-inbox-card";
import { CompletedEmailRow } from "@/app/emails/completed-email-row";
import { InboxEmptyState } from "@/app/emails/inbox-empty-state";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxSearchMessage } from "@/lib/inbox-search/types";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import type { InboxCategoryCatalog } from "@/lib/inbox-category-catalog";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import { inboxEmailAnchorId } from "@/lib/inbox-return-context";

import { calmEmptyMessage, calmSearchLoadingMessage } from "@/lib/calm-system-copy";

type InboxSearchResultsProps = {
  locale: "en" | "it";
  messages: InboxSearchMessage[];
  completedOnly: EmailCompletionRecord[];
  loading: boolean;
  errorMessage?: string | null;
  catalog: InboxCategoryCatalog;
  readStateMap: ReadStateMap;
  showAccountBadges: boolean;
  onCategoryChange: (
    id: string,
    category: InboxAiCategory,
    options?: InboxCategoryChangeOptions,
  ) => void;
  onResetOverride: (id: string) => void;
};

const COPY = {
  en: {
    searching: calmSearchLoadingMessage("en"),
    empty: calmEmptyMessage("en", 0),
    emptyHint: "Try different words or clear filters.",
    completedSection: "Completed matches",
    searchUnavailable: calmEmptyMessage("en", 0),
  },
  it: {
    searching: calmSearchLoadingMessage("it"),
    empty: calmEmptyMessage("it", 0),
    emptyHint: "Prova altre parole o rimuovi i filtri.",
    completedSection: "Completate corrispondenti",
    searchUnavailable: calmEmptyMessage("it", 0),
  },
} as const;

export function InboxSearchResults({
  locale,
  messages,
  completedOnly,
  loading,
  errorMessage,
  catalog,
  readStateMap,
  showAccountBadges,
  onCategoryChange,
  onResetOverride,
}: InboxSearchResultsProps) {
  const t = COPY[locale];

  if (errorMessage) {
    return (
      <InboxEmptyState
        tone="calm"
        title={t.searchUnavailable}
        subtitle={errorMessage}
      />
    );
  }

  if (loading && messages.length === 0 && completedOnly.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">{t.searching}</p>
    );
  }

  if (!loading && messages.length === 0 && completedOnly.length === 0) {
    return (
      <InboxEmptyState
        tone="calm"
        title={t.empty}
        subtitle={t.emptyHint}
      />
    );
  }

  return (
    <div className="space-y-4">
      {messages.length > 0 ? (
        <div className="space-y-2">
          {messages.map((message) => (
            <div key={`${message.accountId ?? ""}:${message.id}`} id={inboxEmailAnchorId(message.id)}>
              {message.searchCompleted ? (
                <div className="relative">
                  <GmailInboxCard
                    message={message as GmailCardMessage}
                    locale={locale}
                    onCategoryChange={onCategoryChange}
                    onResetOverride={onResetOverride}
                    readStateMap={readStateMap}
                    inboxReturnCapture={{ view: "inbox", categoryTab: "all" }}
                    showAccountBadge={showAccountBadges}
                  />
                  {message.completionActionLabel ? (
                    <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      ✓ {message.completionActionLabel}
                    </span>
                  ) : null}
                </div>
              ) : (
                <GmailInboxCard
                  message={message as GmailCardMessage}
                  locale={locale}
                  onCategoryChange={onCategoryChange}
                  onResetOverride={onResetOverride}
                  readStateMap={readStateMap}
                  inboxReturnCapture={{ view: "inbox", categoryTab: "all" }}
                  showAccountBadge={showAccountBadges}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      {completedOnly.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {t.completedSection}
          </h2>
          {completedOnly.map((record) => (
            <CompletedEmailRow
              key={`${record.accountId ?? ""}:${record.emailId}`}
              record={record}
              locale={locale}
              catalog={catalog}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
