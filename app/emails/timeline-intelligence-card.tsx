"use client";

import { useMemo } from "react";
import { ContinuityLines } from "@/app/components/continuity-lines";
import { ConversationStatusChip } from "@/app/components/conversation-status-chip";
import { buildContinuityContext } from "@/lib/continuity-context";
import type { TimelineIntelligenceResult } from "@/lib/timeline-intelligence";

type TimelineIntelligenceCardProps = {
  analysis: TimelineIntelligenceResult;
  locale: "en" | "it";
  sender: string;
  subject: string;
  snippet?: string;
};

export function TimelineIntelligenceCard({
  analysis,
  locale,
  sender,
  subject,
  snippet,
}: TimelineIntelligenceCardProps) {
  if (!analysis?.active) return null;

  const continuity = useMemo(
    () =>
      buildContinuityContext({
        sender,
        subject,
        snippet,
        timeline: analysis,
        locale,
      }),
    [analysis, sender, subject, snippet, locale],
  );

  const lines =
    continuity.lines.length > 0
      ? continuity.lines
      : [analysis.timelineSummary, analysis.calmDetail].filter(
          (x): x is string => Boolean(x),
        );

  const showStatusChip =
    analysis.conversationStatus === "escalating" ||
    analysis.conversationStatus === "stalled" ||
    analysis.conversationStatus === "waiting";

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {showStatusChip ? (
        <ConversationStatusChip
          status={analysis.conversationStatus}
          locale={locale}
          compact
        />
      ) : null}
      <ContinuityLines lines={lines.slice(0, 2)} />
    </div>
  );
}
