"use client";

import { ActionLabelChip } from "@/app/components/action-label-chip";
import {
  REMINDER_SAFETY_NOTE_EN,
  REMINDER_SAFETY_NOTE_IT,
  type ActionIntelligenceResult,
  type ActionLabelId,
} from "@/lib/action-intelligence";

type ActionIntelligenceCardProps = {
  analysis: ActionIntelligenceResult;
  locale: "en" | "it";
};

function taskKindLabel(kind: string, locale: "en" | "it"): string {
  const en: Record<string, string> = {
    date: "Date mentioned",
    promise: "Promise",
    commitment: "Commitment",
    requested_action: "Requested",
  };
  const it: Record<string, string> = {
    date: "Data citata",
    promise: "Promessa",
    commitment: "Impegno",
    requested_action: "Richiesta",
  };
  return locale === "it" ? it[kind] ?? kind : en[kind] ?? kind;
}

export function ActionIntelligenceCard({
  analysis,
  locale,
}: ActionIntelligenceCardProps) {
  if (!analysis?.actionable || !analysis?.primaryLabel) {
    return null;
  }

  const labels = analysis.labels ?? [];
  const secondaryLabels = labels
    .filter((l) => l !== analysis.primaryLabel)
    .slice(0, 1) as ActionLabelId[];

  const reminder = analysis.safeReminders?.[0];
  const safetyNote =
    locale === "it" ? REMINDER_SAFETY_NOTE_IT : REMINDER_SAFETY_NOTE_EN;

  return (
    <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-gradient-to-br from-[#F8FAFC] to-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {locale === "it" ? "Prossimo passo" : "Next step"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <ActionLabelChip label={analysis.primaryLabel} locale={locale} />
        {secondaryLabels.map((l) => (
          <ActionLabelChip key={l} label={l} locale={locale} compact />
        ))}
      </div>

      {analysis.suggestedNextAction ? (
        <p className="text-sm font-medium leading-relaxed text-[#0F172A]">
          {analysis.suggestedNextAction}
        </p>
      ) : null}

      {(analysis.taskAwareness?.length ?? 0) > 0 ? (
        <ul className="space-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-600">
          {(analysis.taskAwareness ?? []).slice(0, 2).map((item, i) => (
            <li key={`${item.kind}-${i}`} className="leading-relaxed">
              <span className="font-medium text-gray-500">
                {taskKindLabel(item.kind, locale)}:
              </span>{" "}
              {item.text}
              {item.when ? (
                <span className="text-gray-400"> · {item.when}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {reminder ? (
        <div className="rounded-lg border border-gray-100 bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
          <p>{reminder.message}</p>
          <button
            type="button"
            disabled
            title={safetyNote}
            className="mt-2 cursor-not-allowed rounded-md border border-gray-200 px-2.5 py-1 text-[10px] font-medium text-gray-400"
          >
            {locale === "it" ? "Imposta promemoria (presto)" : "Set reminder (coming soon)"}
          </button>
        </div>
      ) : null}

      <p className="text-[10px] leading-relaxed text-gray-400">{safetyNote}</p>
    </div>
  );
}
