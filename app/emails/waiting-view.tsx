"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthNav } from "@/app/components/auth-nav";
import { useEmailCompletions } from "@/app/email-completions-context";
import { InboxViewNav } from "@/app/emails/inbox-view-nav";
import { InboxEmptyState } from "@/app/emails/inbox-empty-state";
import { WaitingOnCard } from "@/app/emails/waiting-on-card";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";

const COPY = {
  en: {
    title: "Waiting On",
    subtitle: "A simple list of who still owes you a reply.",
    search: "Search waiting…",
    empty: "Nothing waiting on",
    emptyHint: "When you’re waiting on someone, mark an email ✓ Waiting on someone.",
  },
  it: {
    title: "In attesa",
    subtitle: "Un elenco semplice di chi deve ancora risponderti.",
    search: "Cerca in attesa…",
    empty: "Niente in attesa",
    emptyHint: "Quando aspetti qualcuno, segna l’email come ✓ In attesa.",
  },
} as const;

export function WaitingView() {
  const { activeWaitingRecords } = useEmailCompletions();
  const { uiLanguage } = useUserPreferences();
  const ui = useUiCopy();
  const locale = uiLanguage === "it" ? "it" : "en";
  const t = COPY[locale];
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeWaitingRecords;
    return activeWaitingRecords.filter((record) => {
      const hay = `${record.waitingOn ?? ""} ${record.sender} ${record.subject} ${record.snippet ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeWaitingRecords, query]);

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

        <section className="mt-8 space-y-4">
          {activeWaitingRecords.length > 0 ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
            />
          ) : null}

          {visible.length > 0 ? (
            <div className="space-y-3">
              {visible.map((record) => (
                <WaitingOnCard key={record.emailId} record={record} locale={locale} />
              ))}
            </div>
          ) : activeWaitingRecords.length === 0 ? (
            <InboxEmptyState tone="calm" title={t.empty} subtitle={t.emptyHint} />
          ) : (
            <InboxEmptyState
              tone="calm"
              title={locale === "it" ? "Nessun risultato" : "No matches"}
              subtitle={
                locale === "it"
                  ? "Prova un altro termine di ricerca."
                  : "Try a different search term."
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
