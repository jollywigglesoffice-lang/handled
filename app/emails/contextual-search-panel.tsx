"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiCopy } from "@/app/use-ui-copy";
import { loadClientHandledBrain } from "@/lib/handled-brain/client-storage";
import { loadClientFollowUpReminders } from "@/lib/follow-up-reminders/client-storage";
import {
  searchContextualMemory,
  SMART_SEARCH_FILTERS,
  type ContextualSearchHit,
  type ContextualSearchMessage,
  type SmartSearchFilter,
} from "@/lib/contextual-search";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";

type ContextualSearchPanelProps = {
  messages: ContextualSearchMessage[];
};

const FILTER_LABELS: Record<SmartSearchFilter, { en: string; it: string }> = {
  unresolved: { en: "Unresolved", it: "Aperte" },
  urgent: { en: "Urgent", it: "Urgenti" },
  school: { en: "School", it: "Scuola" },
  doctor: { en: "Doctor", it: "Salute" },
  invoices: { en: "Invoices", it: "Fatture" },
  promotions: { en: "Promotions", it: "Promozioni" },
  waiting_for_response: { en: "Waiting", it: "In attesa" },
};

const SOURCE_LABELS: Record<string, { en: string; it: string }> = {
  email: { en: "Email", it: "Email" },
  email_summary: { en: "Summary", it: "Riepilogo" },
  follow_up: { en: "Follow-up", it: "Follow-up" },
  reminder: { en: "Reminder", it: "Promemoria" },
  relationship: { en: "Relationship", it: "Relazione" },
  handled_brain: { en: "Brain", it: "Brain" },
  timeline: { en: "Timeline", it: "Timeline" },
};

export function ContextualSearchPanel({ messages }: ContextualSearchPanelProps) {
  const ui = useUiCopy();
  const { uiLanguage } = useUserPreferences();
  const locale = uiLocaleFromLanguage(uiLanguage);
  const searchLocale: "en" | "it" = locale === "it" ? "it" : "en";
  const copy = ui.contextualSearch;

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SmartSearchFilter | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const result = useMemo(() => {
    if (!debouncedQuery.trim() && !activeFilter) {
      return null;
    }
    return searchContextualMemory({
      query: debouncedQuery,
      messages,
      locale: searchLocale,
      activeFilter,
      brain: loadClientHandledBrain(),
      reminders: loadClientFollowUpReminders(),
    });
  }, [debouncedQuery, activeFilter, messages, searchLocale]);

  const toggleFilter = useCallback((filter: SmartSearchFilter) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  }, []);

  const showResults = Boolean(result?.active);

  return (
    <section className="rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/40 to-white p-5 shadow-sm">
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-600/90">
          {copy.eyebrow}
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-[#0F172A]">
          {copy.sectionTitle}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          {copy.sectionSubtitle}
        </p>
      </div>

      <label className="sr-only" htmlFor="contextual-search-input">
        {copy.inputLabel}
      </label>
      <input
        id="contextual-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={copy.placeholder}
        className="w-full rounded-xl border border-violet-100 bg-white px-4 py-2.5 text-sm text-[#0F172A] outline-none transition placeholder:text-gray-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        autoComplete="off"
      />

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={copy.filtersLabel}>
        {SMART_SEARCH_FILTERS.map((filter) => {
          const label = FILTER_LABELS[filter][searchLocale];
          const active = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => toggleFilter(filter)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-violet-300 bg-violet-100 text-violet-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {showResults && result?.answer ? (
        <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3">
          <p className="text-xs font-medium text-violet-800">{copy.answerLabel}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">{result.answer.text}</p>
        </div>
      ) : null}

      {showResults && result && result.hits.length > 0 ? (
        <ul className="mt-4 space-y-2" aria-label={copy.resultsLabel}>
          {result.hits.map((hit: ContextualSearchHit) => (
            <SearchHitRow key={hit.record.id} hit={hit} locale={searchLocale} openLabel={copy.openEmail} />
          ))}
        </ul>
      ) : null}

      {debouncedQuery.trim() && result && !result.active ? (
        <p className="mt-4 text-sm text-gray-500">{copy.noResults}</p>
      ) : null}

      {!debouncedQuery.trim() && !activeFilter ? (
        <p className="mt-3 text-xs text-gray-400">{copy.hint}</p>
      ) : null}
    </section>
  );
}

function SearchHitRow({
  hit,
  locale,
  openLabel,
}: {
  hit: ContextualSearchHit;
  locale: "en" | "it";
  openLabel: string;
}) {
  const { record } = hit;
  const sourceLabel = SOURCE_LABELS[record.source]?.[locale] ?? record.source;

  return (
    <li className="rounded-lg border border-slate-100 bg-white/90 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{record.title}</p>
          {hit.snippetHighlight ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {hit.snippetHighlight}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {sourceLabel}
        </span>
      </div>
      {record.emailId ? (
        <Link
          href={`/emails/${encodeURIComponent(record.emailId)}`}
          className="mt-2 inline-block text-xs font-medium text-violet-700 hover:text-violet-900"
        >
          {openLabel}
        </Link>
      ) : null}
    </li>
  );
}
