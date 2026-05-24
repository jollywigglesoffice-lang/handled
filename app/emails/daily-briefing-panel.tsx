"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useUiCopy } from "@/app/use-ui-copy";
import {
  analyzeDailyBriefing,
  type DailyBriefingGroup,
  type DailyBriefingInsight,
  type DailyBriefingMessage,
} from "@/lib/daily-briefing";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";

type DailyBriefingPanelProps = {
  messages: DailyBriefingMessage[];
};

const TONE_STYLES: Record<
  DailyBriefingInsight["tone"],
  string
> = {
  quiet: "text-slate-600 bg-slate-50 border-slate-100",
  positive: "text-emerald-800 bg-emerald-50/80 border-emerald-100",
  neutral: "text-slate-700 bg-slate-50/90 border-slate-100",
  gentle_attention: "text-accent bg-accent-muted/60 border-accent/15",
};

export function DailyBriefingPanel({ messages }: DailyBriefingPanelProps) {
  const ui = useUiCopy();
  const { uiLanguage } = useUserPreferences();
  const locale = uiLocaleFromLanguage(uiLanguage);
  const briefingLocale: "en" | "it" = locale === "it" ? "it" : "en";

  const briefing = useMemo(
    () => analyzeDailyBriefing({ messages, locale: briefingLocale }),
    [messages, briefingLocale],
  );

  if (!briefing.active && messages.length === 0) return null;

  const copy = ui.dailyBriefing;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {copy.eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0F172A]">
          {copy.sectionTitle}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          {copy.sectionSubtitle}
        </p>
        <p className="mt-1 text-xs text-gray-400">{copy.sectionCalmNote}</p>
      </div>

      {briefing.highlights.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={copy.highlightsLabel}>
          {briefing.highlights.map((h) => (
            <li
              key={h.id}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800"
            >
              {h.label}
            </li>
          ))}
        </ul>
      ) : null}

      {briefing.insights.length > 0 ? (
        <ul className="mt-4 space-y-2" aria-label={copy.insightsLabel}>
          {briefing.insights.map((insight) => (
            <li
              key={insight.id}
              className={`rounded-lg border px-3 py-2 text-sm leading-relaxed ${TONE_STYLES[insight.tone]}`}
            >
              {insight.message}
            </li>
          ))}
        </ul>
      ) : null}

      {briefing.groups.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {copy.groupsLabel}
          </p>
          {briefing.groups.map((group: DailyBriefingGroup) => (
            <BriefingGroupRow
              key={group.id}
              group={group}
              openLabel={copy.openGroup}
              moreLabel={copy.moreInGroup}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BriefingGroupRow({
  group,
  openLabel,
  moreLabel,
}: {
  group: DailyBriefingGroup;
  openLabel: string;
  moreLabel: string;
}) {
  const preview = group.emailIds.slice(0, 3);
  const more = group.emailIds.length - preview.length;

  return (
    <div className="rounded-xl border border-slate-100 bg-white/80 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">
          {group.title}
          <span className="ml-2 font-normal text-slate-500">({group.count})</span>
        </p>
      </div>
      {group.calmNote ? (
        <p className="mt-1 text-xs text-slate-500">{group.calmNote}</p>
      ) : null}
      <ul className="mt-2 flex flex-wrap gap-2">
        {preview.map((id) => (
          <li key={id}>
            <Link
              href={`/emails/${encodeURIComponent(id)}`}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {openLabel}
            </Link>
          </li>
        ))}
        {more > 0 ? (
          <li className="self-center text-xs text-slate-400">
            {moreLabel.replace("{count}", String(more))}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
