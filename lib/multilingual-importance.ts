import { hasMultilingualImportanceSignal, isPersonalPriorityContext } from "@/lib/categorization-intelligence/priority-signals";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type PersonalImportanceResult = {
  important: boolean;
  suggestedCategory: InboxAiCategory;
  confidence: number;
  reasons: string[];
};

export function emailHaystackForImportance(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): string {
  return `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
}

/** @deprecated Prefer analyzeCategorizationIntelligence — kept for legacy callers. */
export function detectPersonalImportance(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
): PersonalImportanceResult {
  const important = isPersonalPriorityContext(row);
  return {
    important,
    suggestedCategory: important ? "needs_attention" : "handled",
    confidence: important ? 0.84 : 0.5,
    reasons: important ? ["intelligence_priority_context"] : [],
  };
}

export { hasMultilingualImportanceSignal };
