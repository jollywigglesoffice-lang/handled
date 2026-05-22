"use client";

import { useCallback, useMemo, useState } from "react";
import { ProactiveSuggestionCard } from "@/app/emails/proactive-suggestion-card";
import {
  dismissProactiveSuggestion,
  filterDismissedSuggestions,
  type ProactiveAssistantResult,
} from "@/lib/proactive-assistant";

type ProactiveAssistantCardProps = {
  analysis: ProactiveAssistantResult;
  locale: "en" | "it";
};

export function ProactiveAssistantCard({
  analysis,
  locale,
}: ProactiveAssistantCardProps) {
  const [dismissTick, setDismissTick] = useState(0);

  const suggestions = useMemo(() => {
    void dismissTick;
    return filterDismissedSuggestions(analysis?.suggestions ?? []);
  }, [analysis?.suggestions, dismissTick]);

  const handleDismiss = useCallback((id: string) => {
    dismissProactiveSuggestion(id);
    setDismissTick((t) => t + 1);
  }, []);

  if (!analysis?.active || suggestions.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/30 to-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
        {locale === "it" ? "Assistente proattivo" : "Proactive assistant"}
      </p>
      <p className="text-xs leading-relaxed text-teal-900/80">
        {locale === "it"
          ? "Suggerimenti basati su impegni e tempistiche — approvazione sempre necessaria."
          : "Suggestions from commitments and timing — your approval always required."}
      </p>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <ProactiveSuggestionCard
            key={s.id}
            suggestion={s}
            locale={locale}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
}
