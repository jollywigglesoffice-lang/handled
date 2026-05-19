import { isCalendarConnected } from "@/lib/calendar-awareness/connection";
import type { KnowledgeChunk, KnowledgeRetrievalInput } from "@/lib/knowledge/types";

/**
 * Future Google Calendar knowledge provider.
 * Will return availability snippets for scheduling intents when connected.
 */
export function scoreGoogleCalendarKnowledge(
  _input: KnowledgeRetrievalInput,
): KnowledgeChunk[] {
  if (!isCalendarConnected()) return [];
  // Placeholder — no calendar reads until OAuth + user consent ship
  return [];
}
