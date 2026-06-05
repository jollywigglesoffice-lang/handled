"use client";

import { useInboxCategories } from "@/app/inbox-categories-context";
import { inboxCategoryTitle, type InboxAiCategory } from "@/lib/inbox-category-catalog";

export type CategoryTab = InboxAiCategory | "all" | "completed";

type CategoryTabsProps = {
  active: CategoryTab;
  counts: Record<string, number>;
  total: number;
  completedCount?: number;
  locale: "en" | "it";
  onChange: (tab: CategoryTab) => void;
};

export function CategoryTabs({
  active,
  counts,
  total,
  completedCount = 0,
  locale,
  onChange,
}: CategoryTabsProps) {
  const { catalog } = useInboxCategories();
  const allLabel = locale === "it" ? "Tutte" : "All";
  const completedLabel = locale === "it" ? "Completate" : "Completed";

  return (
    <nav
      aria-label={locale === "it" ? "Categorie" : "Categories"}
      className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <TabPill
        label={allLabel}
        count={total}
        active={active === "all"}
        onClick={() => onChange("all")}
      />
      {catalog.tabOrder.map((category) => (
        <TabPill
          key={category}
          label={inboxCategoryTitle(category, locale, catalog)}
          count={counts[category] ?? 0}
          active={active === category}
          onClick={() => onChange(category)}
        />
      ))}
      {completedCount > 0 ? (
        <TabPill
          label={completedLabel}
          count={completedCount}
          active={active === "completed"}
          onClick={() => onChange("completed")}
        />
      ) : null}
    </nav>
  );
}

function TabPill({
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
      className={`group inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        active
          ? "bg-[#9733ff] text-white shadow-sm shadow-accent/20"
          : "bg-gray-50 text-gray-600 hover:bg-accent-muted hover:text-accent"
      }`}
    >
      <span>{label}</span>
      <span
        className={`min-w-4 rounded-full px-1 text-center text-xs tabular-nums transition ${
          active ? "bg-white/20 text-white" : "text-gray-400 group-hover:text-accent"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
