"use client";

import { ConversationStatusChip } from "@/app/components/conversation-status-chip";
import type { TimelineIntelligenceResult } from "@/lib/timeline-intelligence";
import { trajectoryLabel } from "@/lib/timeline-intelligence/labels";

type TimelineIntelligenceCardProps = {
  analysis: TimelineIntelligenceResult;
  locale: "en" | "it";
};

export function TimelineIntelligenceCard({
  analysis,
  locale,
}: TimelineIntelligenceCardProps) {
  if (!analysis.active) return null;

  const memoryBullets: string[] = [];
  if (analysis.threadMemory.requestedActions[0]) {
    memoryBullets.push(analysis.threadMemory.requestedActions[0]!);
  }
  if (analysis.threadMemory.mentionedDeadlines[0]) {
    memoryBullets.push(
      locale === "it"
        ? `Scadenza: ${analysis.threadMemory.mentionedDeadlines[0]}`
        : `Deadline: ${analysis.threadMemory.mentionedDeadlines[0]}`,
    );
  }
  if (analysis.threadMemory.mentionedAttachments) {
    memoryBullets.push(
      locale === "it" ? "Allegato citato" : "Attachment mentioned",
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {locale === "it" ? "Timeline conversazione" : "Conversation timeline"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <ConversationStatusChip
          status={analysis.conversationStatus}
          locale={locale}
          compact
        />
        {analysis.trajectory !== "calm" && analysis.trajectory !== "informational" ? (
          <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500">
            {trajectoryLabel(analysis.trajectory, locale)}
          </span>
        ) : null}
      </div>

      <p className="text-sm font-medium leading-relaxed text-[#0F172A]">
        {analysis.timelineSummary}
      </p>
      {analysis.calmDetail ? (
        <p className="text-xs leading-relaxed text-gray-500">{analysis.calmDetail}</p>
      ) : null}

      {memoryBullets.length > 0 ? (
        <ul className="space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
          {memoryBullets.slice(0, 2).map((line, i) => (
            <li key={i} className="leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[10px] leading-relaxed text-gray-400">
        {locale === "it"
          ? "Handled osserva il thread nel tempo — nessun promemoria invasivo."
          : "Handled watches the thread over time — no noisy reminders."}
      </p>
    </div>
  );
}
