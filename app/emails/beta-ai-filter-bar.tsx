"use client";

import { betaStateLabel } from "@/lib/beta-inbox/state";
import type { BetaAiFilter } from "@/lib/beta-inbox/filter";

type BetaAiFilterBarProps = {
  active: BetaAiFilter;
  counts: Record<BetaAiFilter, number>;
  locale: "en" | "it";
  onChange: (filter: BetaAiFilter) => void;
};

const COPY = {
  en: {
    label: "AI suggestions",
    all: "All emails",
    hint: "Categories below are always complete — this only narrows what you see.",
  },
  it: {
    label: "Suggerimenti IA",
    all: "Tutte le email",
    hint: "Le categorie sotto sono sempre complete — questo restringe solo la vista.",
  },
} as const;

export function BetaAiFilterBar({ active, counts, locale, onChange }: BetaAiFilterBarProps) {
  const t = COPY[locale];

  return (
    <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.label}</p>
        <p className="text-[11px] text-gray-400">{t.hint}</p>
      </div>
      <nav
        aria-label={t.label}
        className="flex flex-wrap gap-1.5"
      >
        <FilterPill
          label={t.all}
          count={counts.all}
          active={active === "all"}
          onClick={() => onChange("all")}
        />
        <FilterPill
          label={betaStateLabel("worth_your_attention", locale)}
          count={counts.worth_your_attention}
          active={active === "worth_your_attention"}
          onClick={() => onChange("worth_your_attention")}
        />
        <FilterPill
          label={betaStateLabel("suggested", locale)}
          count={counts.suggested}
          active={active === "suggested"}
          onClick={() => onChange("suggested")}
        />
      </nav>
    </div>
  );
}

function FilterPill({
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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        active
          ? "bg-[#9733ff] text-white shadow-sm"
          : "bg-white text-gray-600 hover:bg-accent-muted hover:text-accent"
      }`}
    >
      <span>{label}</span>
      <span
        className={`min-w-4 rounded-full px-1 text-center text-xs tabular-nums ${
          active ? "bg-white/20 text-white" : "text-gray-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
