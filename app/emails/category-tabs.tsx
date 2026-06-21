"use client";

import { useInboxCategories } from "@/app/inbox-categories-context";
import { CANONICAL_CATEGORY_ORDER } from "@/lib/inbox-ai-categories";
import { inboxModeTitle, type InboxModeLocale } from "@/lib/inbox-modes";
import type { InboxAiCategory } from "@/lib/inbox-category-catalog";

export type CategoryTab = InboxAiCategory | "all";

type CategoryTabsProps = {
  active: CategoryTab;
  counts: Record<string, number>;
  total: number;
  locale: InboxModeLocale;
  completedCount: number;
  onChange: (tab: CategoryTab) => void;
};

export function CategoryTabs({
  active,
  counts,
  total,
  locale,
  completedCount,
  onChange,
}: CategoryTabsProps) {
  const { catalog } = useInboxCategories();
  const allLabel = locale === "it" ? "Tutto" : "All";

  const tabOrder = CANONICAL_CATEGORY_ORDER.filter((id) =>
    catalog.allIds.includes(id),
  );

  return (
    <nav
      aria-label={locale === "it" ? "Categorie inbox" : "Inbox categories"}
      className="-mx-1 flex flex-nowrap items-end gap-4 overflow-x-auto border-b border-gray-100 px-1 pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ModeTab
        label={allLabel}
        count={total}
        active={active === "all"}
        onClick={() => onChange("all")}
      />
      {tabOrder.map((category) => (
        <ModeTab
          key={category}
          label={inboxModeTitle(category, locale, catalog)}
          count={counts[category] ?? 0}
          active={active === category}
          onClick={() => onChange(category)}
        />
      ))}
    </nav>
  );
}

function ModeTab({
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
      aria-pressed={active}
      className={`group relative shrink-0 pb-2.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
        active
          ? "font-medium text-gray-900"
          : "font-normal text-gray-400 hover:text-gray-600"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {count > 0 ? (
          <span
            className={`tabular-nums text-xs ${
              active ? "text-gray-400" : "text-gray-300 group-hover:text-gray-400"
            }`}
          >
            {count}
          </span>
        ) : null}
      </span>
      {active ? (
        <span
          className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gray-900"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

