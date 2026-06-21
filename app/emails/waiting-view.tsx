"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthNav } from "@/app/components/auth-nav";
import { useEmailCompletions } from "@/app/email-completions-context";
import { WaitingDashboardSummary } from "@/app/emails/waiting-dashboard-summary";
import { InboxViewNav } from "@/app/emails/inbox-view-nav";
import { InboxEmptyState } from "@/app/emails/inbox-empty-state";
import { WaitingOnCard } from "@/app/emails/waiting-on-card";
import { WaitingResponseCard } from "@/app/emails/waiting-response-card";
import { useWaitingOnMetadata, useSyncWaitingMetadata } from "@/app/waiting-on-metadata-context";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import {
  buildWaitingBriefingLines,
  buildWaitingDashboardItems,
  computeWaitingDashboardSummary,
} from "@/lib/waiting-on/dashboard";

const COPY = {
  en: {
    title: "Waiting On",
    subtitle: "Track commitments and responses you're waiting to receive.",
    search: "Search waiting…",
    empty: "Nothing waiting on",
    emptyHint: "When you're waiting on someone, mark an email ✓ Waiting on someone.",
    responseSection: "Response received",
    waitingSection: "Still waiting",
    briefingTitle: "Morning briefing",
  },
  it: {
    title: "In attesa",
    subtitle: "Tieni traccia di impegni e risposte che stai aspettando.",
    search: "Cerca in attesa…",
    empty: "Niente in attesa",
    emptyHint: "Quando aspetti qualcuno, segna l'email come ✓ In attesa.",
    responseSection: "Risposta ricevuta",
    waitingSection: "Ancora in attesa",
    briefingTitle: "Briefing del mattino",
  },
} as const;

export function WaitingView() {
  return <WaitingViewContent />;
}

function WaitingViewContent() {
  const { completions, activeWaitingRecords, waitingOpenRecords, waitingResponseRecords } =
    useEmailCompletions();
  const { metadata } = useWaitingOnMetadata();
  useSyncWaitingMetadata(completions);

  const { uiLanguage } = useUserPreferences();
  const ui = useUiCopy();
  const locale = uiLanguage === "it" ? "it" : "en";
  const t = COPY[locale];
  const [query, setQuery] = useState("");

  const dashboardItems = useMemo(
    () => buildWaitingDashboardItems(completions, metadata, locale),
    [completions, metadata, locale],
  );

  const summary = useMemo(
    () => computeWaitingDashboardSummary(dashboardItems),
    [dashboardItems],
  );

  const briefingLines = useMemo(
    () => buildWaitingBriefingLines(summary, locale),
    [summary, locale],
  );

  const filterRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (record: (typeof activeWaitingRecords)[number]) => {
      const hay = `${record.waitingOn ?? ""} ${record.sender} ${record.subject} ${record.snippet ?? ""} ${record.waitingResponseSubject ?? ""}`.toLowerCase();
      return hay.includes(q);
    };
  }, [query]);

  const visibleResponses = useMemo(() => {
    if (!filterRecords) return waitingResponseRecords;
    return waitingResponseRecords.filter(filterRecords);
  }, [waitingResponseRecords, filterRecords]);

  const visibleOpen = useMemo(() => {
    if (!filterRecords) return waitingOpenRecords;
    return waitingOpenRecords.filter(filterRecords);
  }, [waitingOpenRecords, filterRecords]);

  const hasAny = activeWaitingRecords.length > 0;

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

        <section className="mt-8 space-y-6">
          {hasAny ? (
            <>
              <WaitingDashboardSummary summary={summary} locale={locale} linkToWaiting={false} />

              {briefingLines.length > 0 ? (
                <section className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {t.briefingTitle}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {briefingLines.map((line) => (
                      <li key={line.id} className="text-sm text-gray-700">
                        {line.label}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search}
                className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
              />
            </>
          ) : null}

          {!hasAny ? (
            <InboxEmptyState tone="calm" title={t.empty} subtitle={t.emptyHint} />
          ) : (
            <>
              {visibleResponses.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {t.responseSection}
                  </h2>
                  {visibleResponses.map((record) => (
                    <WaitingResponseCard key={record.emailId} record={record} locale={locale} />
                  ))}
                </div>
              ) : null}

              {visibleOpen.length > 0 ? (
                <div className="space-y-3">
                  {visibleResponses.length > 0 ? (
                    <h2 className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {t.waitingSection}
                    </h2>
                  ) : null}
                  {visibleOpen.map((record) => (
                    <WaitingOnCard key={record.emailId} record={record} locale={locale} />
                  ))}
                </div>
              ) : null}

              {visibleResponses.length === 0 && visibleOpen.length === 0 ? (
                <InboxEmptyState
                  tone="calm"
                  title={locale === "it" ? "Nessun risultato" : "No matches"}
                  subtitle={
                    locale === "it"
                      ? "Prova un altro termine di ricerca."
                      : "Try a different search term."
                  }
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
