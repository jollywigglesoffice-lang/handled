"use client";

import { useInboxCategories } from "@/app/inbox-categories-context";
import { inboxCategoryTitle, type InboxAiCategory } from "@/lib/inbox-category-catalog";
import {
  estimateClearSeconds,
  formatDuration,
} from "@/lib/inbox-zero/estimate";

type InboxSummaryCardProps = {
  counts: Record<InboxAiCategory, number>;
  locale: "en" | "it";
  onClearPromotions: () => void;
  onHandleQuickReplies: () => void;
  onInboxZero: () => void;
};

const COPY = {
  en: {
    estimated: "Estimated time to clear",
    clearPromotions: "Clear Promotions",
    handleQuickReplies: "Handle Quick Replies",
    inboxZero: "Inbox Zero",
    allClear: "Your inbox is clear.",
  },
  it: {
    estimated: "Tempo stimato per svuotare",
    clearPromotions: "Svuota Promozioni",
    handleQuickReplies: "Gestisci Risposte Veloci",
    inboxZero: "Inbox Zero",
    allClear: "La tua inbox è vuota.",
  },
} as const;

export function InboxSummaryCard({
  counts,
  locale,
  onClearPromotions,
  onHandleQuickReplies,
  onInboxZero,
}: InboxSummaryCardProps) {
  const { catalog } = useInboxCategories();
  const t = COPY[locale];
  const rows = catalog.summaryOrder.filter((category) => counts[category] > 0);
  const total = rows.reduce((sum, category) => sum + counts[category], 0);
  if (total === 0) return null;

  const seconds = estimateClearSeconds(counts);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)] ring-1 ring-gray-100 sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <dl className="flex flex-wrap gap-x-7 gap-y-3">
            {rows.map((category) => (
              <div key={category} className="flex items-baseline gap-1.5">
                <dt className="text-lg font-semibold tabular-nums text-[#0F172A]">
                  {counts[category]}
                </dt>
                <dd className="text-sm text-gray-500">
                  {inboxCategoryTitle(category, locale, catalog)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">{t.estimated}</p>
            <p className="text-sm font-medium text-accent">{formatDuration(seconds, locale)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onInboxZero}
            className="rounded-xl bg-[#9733ff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9733ff] focus-visible:ring-offset-2"
          >
            {t.inboxZero}
          </button>
          {counts.worth_your_attention > 0 ? (
            <SecondaryAction onClick={onHandleQuickReplies}>
              {locale === "it" ? "Gestisci priorità" : "Handle priorities"}
            </SecondaryAction>
          ) : null}
          {counts.promotions > 0 ? (
            <SecondaryAction onClick={onClearPromotions}>
              {t.clearPromotions}
            </SecondaryAction>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SecondaryAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-accent-muted px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {children}
    </button>
  );
}
