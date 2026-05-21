import {
  analyzeProactiveAssistant,
  summarizeProactiveAssistant,
} from "@/lib/proactive-assistant/analyze";
import type {
  AnalyzeProactiveInput,
  ProactiveAssistantSummary,
  ProactiveSuggestion,
} from "@/lib/proactive-assistant/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";

export type MessageWithProactiveAssistant<T> = T & {
  proactiveAssistant?: ProactiveAssistantSummary;
};

export function enrichMessageWithProactiveAssistant<
  T extends AnalyzeProactiveInput["row"] & { category?: InboxAiCategory },
>(
  row: T,
  options?: {
    senderRelationships?: SenderRelationship[];
    extraBody?: string;
    locale?: "en" | "it";
    threadMessages?: AnalyzeProactiveInput["row"][];
  },
): MessageWithProactiveAssistant<T> {
  const result = analyzeProactiveAssistant({
    row,
    extraBody: options?.extraBody,
    locale: options?.locale,
    senderRelationships: options?.senderRelationships,
    threadMessages: options?.threadMessages,
  });
  const summary = summarizeProactiveAssistant(result);
  if (!summary.active) return row;
  return { ...row, proactiveAssistant: summary };
}

export function enrichInboxProactiveSummaries<
  T extends AnalyzeProactiveInput["row"] & { category?: InboxAiCategory },
>(rows: T[], senderRelationships?: SenderRelationship[]): MessageWithProactiveAssistant<T>[] {
  return rows.map((row) => {
    const siblings = rows.filter(
      (m) => (m.threadId ?? m.id) === (row.threadId ?? row.id),
    );
    return enrichMessageWithProactiveAssistant(row, {
      senderRelationships,
      threadMessages: siblings,
    });
  });
}

export type { ProactiveSuggestion };
