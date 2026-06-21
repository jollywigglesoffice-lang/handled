"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthNav } from "@/app/components/auth-nav";
import { useCompletionActions } from "@/app/completion-actions-context";
import { useEmailCompletions } from "@/app/email-completions-context";
import { CompletedEmailRow } from "@/app/emails/completed-email-row";
import { InboxViewNav } from "@/app/emails/inbox-view-nav";
import { InboxEmptyState } from "@/app/emails/inbox-empty-state";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import { useInboxCategories } from "@/app/inbox-categories-context";
import {
  completionFiltersForView,
  completedHistoryRecords,
  countCompletionsByAction,
  filterCompletionRecords,
  type CompletionActionFilter,
} from "@/lib/completion-stats";
import {
  consumeInboxScrollRestore,
  scrollToInboxEmail,
} from "@/lib/inbox-return-context";

const COPY = {
  en: {
    title: "Completed",
    subtitle: "Finished emails — still searchable here.",
    search: "Search completed…",
    all: "All",
    empty: "Nothing completed yet",
    emptyHint: "When you mark an email as Handled, it lands here.",
    back: "Back to inbox",
  },
  it: {
    title: "Completate",
    subtitle: "Email finite — ancora ricercabili qui.",
    search: "Cerca nelle completate…",
    all: "Tutte",
    empty: "Nessuna email completata",
    emptyHint: "Quando segni un'email come Gestita, compare qui.",
    back: "Torna all'inbox",
  },
} as const;

export function CompletedView() {
  const { completions } = useEmailCompletions();
  const { catalog: actionCatalog } = useCompletionActions();
  const { catalog: inboxCatalog } = useInboxCategories();
  const { uiLanguage } = useUserPreferences();
  const ui = useUiCopy();
  const locale = uiLanguage === "it" ? "it" : "en";
  const t = COPY[locale];

  const [filter, setFilter] = useState<CompletionActionFilter>("all");
  const [query, setQuery] = useState("");

  const allRecords = useMemo(() => completedHistoryRecords(completions), [completions]);
  const actionCounts = useMemo(
    () => countCompletionsByAction(completions, { excludeActiveWaiting: true }),
    [completions],
  );
  const filterOptions = useMemo(
    () => completionFiltersForView(completions, actionCatalog),
    [completions, actionCatalog],
  );

  const visible = useMemo(
    () => filterCompletionRecords(allRecords, filter, query),
    [allRecords, filter, query],
  );

  useEffect(() => {
    const restore = consumeInboxScrollRestore();
    if (!restore || restore.view !== "completed") return;

    if (restore.completedFilter) {
      setFilter(restore.completedFilter as CompletionActionFilter);
    }

    const timer = window.setTimeout(() => {
      scrollToInboxEmail(restore.anchorEmailId, restore.scrollY);
    }, 150);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <InboxViewNav locale={locale} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t.title}</h1>
              <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuthNav />
            <Link href="/settings" className="link-accent text-xs">
              {ui.home.settingsButton}
            </Link>
          </div>
        </header>

        <section className="mt-8 space-y-5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
          />

          {allRecords.length > 0 ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  filter === "all"
                    ? "bg-accent-muted font-medium text-accent"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{t.all}</span>
                <span className="text-xs tabular-nums text-gray-400">{allRecords.length}</span>
              </button>
              {filterOptions.map((actionId) => (
                <FilterRow
                  key={actionId}
                  active={filter === actionId}
                  label={actionCatalog.labelFor(actionId, locale)}
                  count={actionCounts[actionId] ?? 0}
                  onClick={() => setFilter(actionId)}
                />
              ))}
            </div>
          ) : null}

          {visible.length > 0 ? (
            <div className="space-y-2">
              {visible.map((record) => (
                <CompletedEmailRow
                  key={record.emailId}
                  record={record}
                  locale={locale}
                  catalog={inboxCatalog}
                  completedFilter={filter}
                />
              ))}
            </div>
          ) : allRecords.length === 0 ? (
            <InboxEmptyState tone="calm" title={t.empty} subtitle={t.emptyHint} />
          ) : (
            <InboxEmptyState
              tone="calm"
              title={locale === "it" ? "Nessun risultato" : "No matches"}
              subtitle={
                locale === "it"
                  ? "Prova un altro filtro o termine di ricerca."
                  : "Try a different filter or search term."
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
        active ? "bg-accent-muted font-medium text-accent" : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span>✓ {label}</span>
      <span className="text-xs tabular-nums text-gray-400">{count}</span>
    </button>
  );
}
