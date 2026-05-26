"use client";

import { useCallback, useMemo, useState } from "react";
import { ProactiveSuggestionCard } from "@/app/emails/proactive-suggestion-card";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  analyzeProactiveAssistantInbox,
  dismissProactiveSuggestion,
  filterDismissedSuggestions,
  type ProactiveSuggestion,
} from "@/lib/proactive-assistant";

type InboxMessageForProactive = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  category: InboxAiCategory;
  internalDateMs?: number;
  date?: string;
};

type ProactiveSuggestionsPanelProps = {
  messages: InboxMessageForProactive[];
  locale: "en" | "it";
};

export function ProactiveSuggestionsPanel({
  messages,
  locale,
}: ProactiveSuggestionsPanelProps) {
  const [dismissTick, setDismissTick] = useState(0);

  const suggestions = useMemo(() => {
    void dismissTick;
    const rows = messages.map((m) => ({
      id: m.id,
      threadId: m.threadId ?? m.id,
      sender: m.sender,
      subject: m.subject,
      snippet: m.snippet,
      internalDateMs: m.internalDateMs ?? (m.date ? new Date(m.date).getTime() : 0),
      category: m.category,
    }));
    const raw = analyzeProactiveAssistantInbox(rows, { locale, maxSuggestions: 5 });
    return filterDismissedSuggestions(raw);
  }, [messages, locale, dismissTick]);

  const handleDismiss = useCallback((id: string) => {
    dismissProactiveSuggestion(id);
    setDismissTick((t) => t + 1);
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm">
      <div className="border-b border-teal-50 pb-4">
        <h2 className="text-lg font-semibold tracking-tight text-[#0F172A]">
          {locale === "it" ? "Suggerimenti per te" : "Gentle suggestions"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          {locale === "it"
            ? "Impegni e scadenze in vista — tu decidi cosa fare."
            : "Commitments and timing in view — you decide what to do."}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {locale === "it"
            ? "Nessuna azione automatica. Nascondi ciò che non ti serve."
            : "Nothing happens automatically. Dismiss anything that does not help."}
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {suggestions.map((s: ProactiveSuggestion) => (
          <ProactiveSuggestionCard
            key={s.id}
            suggestion={s}
            locale={locale}
            onDismiss={handleDismiss}
            compact
          />
        ))}
      </div>
    </section>
  );
}
