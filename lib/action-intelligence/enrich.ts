import {
  analyzeActionIntelligence,
  summarizeActionIntelligence,
} from "@/lib/action-intelligence/analyze";
import type {
  ActionIntelligenceSummary,
  AnalyzeActionIntelligenceInput,
} from "@/lib/action-intelligence/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type MessageWithActionIntelligence<T> = T & {
  actionIntelligence?: ActionIntelligenceSummary;
};

export function enrichMessageWithActionIntelligence<
  T extends Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
>(
  row: T,
  options?: {
    category?: InboxAiCategory;
    extraBody?: string;
    locale?: "en" | "it";
  },
): MessageWithActionIntelligence<T> {
  const analysis = analyzeActionIntelligence({
    row,
    category: options?.category,
    extraBody: options?.extraBody,
    locale: options?.locale,
  });
  const summary = summarizeActionIntelligence(analysis);
  if (!summary.actionable) {
    return row;
  }
  return {
    ...row,
    actionIntelligence: summary,
  };
}

export function analyzeRowActions(input: AnalyzeActionIntelligenceInput) {
  return analyzeActionIntelligence(input);
}
