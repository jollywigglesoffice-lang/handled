"use client";

import { useInboxCategories } from "@/app/inbox-categories-context";
import type { AccountFilterValue } from "@/app/emails/inbox-source-switcher";
import type { CategoryTab } from "@/app/emails/category-tabs";
import { inboxCategoryTitle } from "@/lib/inbox-category-catalog";
import type { ConnectedGmailAccount } from "@/lib/gmail/account-types";
import type { InboxSearchFilters } from "@/lib/inbox-search/types";

type InboxSearchBarProps = {
  locale: "en" | "it";
  accounts: ConnectedGmailAccount[];
  filters: InboxSearchFilters;
  onFiltersChange: (filters: InboxSearchFilters) => void;
  resultCount?: number;
  loading?: boolean;
};

const COPY = {
  en: {
    placeholder: "Search subject, sender, or body…",
    category: "Category",
    account: "Account",
    read: "Read status",
    all: "All",
    unread: "Unread",
    readOnly: "Read",
    results: (n: number) => (n === 1 ? "1 result" : `${n} results`),
    searching: "Searching…",
  },
  it: {
    placeholder: "Cerca oggetto, mittente o testo…",
    category: "Categoria",
    account: "Account",
    read: "Stato lettura",
    all: "Tutte",
    unread: "Da leggere",
    readOnly: "Lette",
    results: (n: number) => (n === 1 ? "1 risultato" : `${n} risultati`),
    searching: "Ricerca…",
  },
} as const;

export function InboxSearchBar({
  locale,
  accounts,
  filters,
  onFiltersChange,
  resultCount,
  loading,
}: InboxSearchBarProps) {
  const { catalog } = useInboxCategories();
  const t = COPY[locale];
  const active = filters.query.trim().length >= 2;

  function patch(partial: Partial<InboxSearchFilters>) {
    onFiltersChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-gray-100 bg-white/90 px-4 py-3 shadow-sm">
      <div className="relative">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 pl-4 pr-10 text-sm outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
        />
        {loading ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            …
          </span>
        ) : active && resultCount !== undefined ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {t.results(resultCount)}
          </span>
        ) : null}
      </div>

      {active ? (
        <div className="space-y-2 border-t border-gray-50 pt-2.5">
          <FilterRow label={t.category}>
            <FilterPill
              active={filters.category === "all"}
              label={t.all}
              onClick={() => patch({ category: "all" })}
            />
            {catalog.tabOrder.map((category) => (
              <FilterPill
                key={category}
                active={filters.category === category}
                label={inboxCategoryTitle(category, locale, catalog)}
                onClick={() => patch({ category: category as CategoryTab })}
              />
            ))}
          </FilterRow>

          {accounts.length > 1 ? (
            <FilterRow label={t.account}>
              <FilterPill
                active={filters.accountId === "all"}
                label={t.all}
                onClick={() => patch({ accountId: "all" })}
              />
              {accounts.map((account) => (
                <FilterPill
                  key={account.id}
                  active={filters.accountId === account.id}
                  label={account.label}
                  onClick={() => patch({ accountId: account.id as AccountFilterValue })}
                />
              ))}
            </FilterRow>
          ) : null}

          <FilterRow label={t.read}>
            <FilterPill
              active={filters.read === "all"}
              label={t.all}
              onClick={() => patch({ read: "all" })}
            />
            <FilterPill
              active={filters.read === "unread"}
              label={t.unread}
              onClick={() => patch({ read: "unread" })}
            />
            <FilterPill
              active={filters.read === "read"}
              label={t.readOnly}
              onClick={() => patch({ read: "read" })}
            />
          </FilterRow>
        </div>
      ) : null}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? "border-gray-300 bg-white text-[#0F172A] shadow-sm"
          : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}
