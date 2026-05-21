"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useUiCopy } from "@/app/use-ui-copy";
import {
  analyzeDailyWorkspace,
  type DailyWorkspaceMessage,
  type WorkspaceItem,
  type WorkspaceSection,
} from "@/lib/daily-workspace";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";

type DailyWorkspacePanelProps = {
  messages: DailyWorkspaceMessage[];
};

const SECTION_ACCENT: Record<string, string> = {
  todays_focus: "border-l-indigo-400",
  waiting_on: "border-l-slate-400",
  suggested_actions: "border-l-teal-400",
};

export function DailyWorkspacePanel({ messages }: DailyWorkspacePanelProps) {
  const ui = useUiCopy();
  const { uiLanguage } = useUserPreferences();
  const locale = uiLocaleFromLanguage(uiLanguage);
  const workspaceLocale: "en" | "it" = locale === "it" ? "it" : "en";
  const copy = ui.dailyWorkspace;

  const workspace = useMemo(
    () => analyzeDailyWorkspace({ messages, locale: workspaceLocale }),
    [messages, workspaceLocale],
  );

  if (!workspace.active) return null;

  const hasWork =
    workspace.stats.focusCount > 0 ||
    workspace.stats.waitingCount > 0 ||
    workspace.stats.suggestedCount > 0;

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm">
      <header className="border-b border-slate-100 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600/90">
          {copy.eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#0F172A]">
          {copy.sectionTitle}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          {copy.sectionSubtitle}
        </p>
        {workspace.workspaceNote ? (
          <p className="mt-2 text-xs text-gray-400">{workspace.workspaceNote}</p>
        ) : null}
      </header>

      {workspace.calmDay && !hasWork ? (
        <p className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-4 text-sm leading-relaxed text-slate-600">
          {copy.calmDayMessage}
        </p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          {workspace.sections.map((section) => (
            <WorkspaceSectionBlock
              key={section.id}
              section={section}
              emptyLabel={copy.emptySection}
              openLabel={copy.openEmail}
            />
          ))}
        </div>
      )}

      <p className="mt-5 text-center text-xs text-gray-400">{copy.fullInboxHint}</p>
    </section>
  );
}

function WorkspaceSectionBlock({
  section,
  emptyLabel,
  openLabel,
}: {
  section: WorkspaceSection;
  emptyLabel: string;
  openLabel: string;
}) {
  const accent = SECTION_ACCENT[section.id] ?? "border-l-slate-300";

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-[#0F172A]">{section.title}</h3>
      {section.calmNote ? (
        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{section.calmNote}</p>
      ) : null}

      {section.items.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {section.items.map((item) => (
            <WorkspaceItemRow
              key={item.id}
              item={item}
              accent={accent}
              openLabel={openLabel}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkspaceItemRow({
  item,
  accent,
  openLabel,
}: {
  item: WorkspaceItem;
  accent: string;
  openLabel: string;
}) {
  return (
    <li
      className={`rounded-lg border border-slate-100 border-l-[3px] bg-slate-50/50 px-3 py-2.5 ${accent}`}
    >
      <p className="text-sm font-medium leading-snug text-slate-800">{item.title}</p>
      {item.calmDetail ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
          {item.calmDetail}
        </p>
      ) : null}
      <Link
        href={`/emails/${encodeURIComponent(item.emailId)}`}
        className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:text-indigo-900"
      >
        {openLabel}
      </Link>
    </li>
  );
}
