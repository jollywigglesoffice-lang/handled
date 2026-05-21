import { buildSearchMemoryIndex } from "@/lib/contextual-search/build-index";
import { parseSearchQuery } from "@/lib/contextual-search/parse-query";
import { buildSearchAnswer } from "@/lib/contextual-search/answer";
import { rankSearchHits, scoreMemoryRecord } from "@/lib/contextual-search/score";
import type {
  ContextualSearchResult,
  SearchMemoryInput,
  SmartSearchFilter,
} from "@/lib/contextual-search/types";

export function searchContextualMemory(
  input: SearchMemoryInput,
): ContextualSearchResult {
  const locale = input.locale ?? "en";
  const query = input.query.trim();
  const parsed = parseSearchQuery(query);
  const activeFilter = input.activeFilter ?? parsed.inferredFilter ?? undefined;

  if (!query && !activeFilter) {
    return {
      query,
      intents: parsed.intents,
      hits: [],
      answer: null,
      active: false,
    };
  }

  const index = buildSearchMemoryIndex({
    messages: input.messages,
    brain: input.brain,
    reminders: input.reminders,
  });

  const hits = index
    .map((record) => scoreMemoryRecord(record, parsed, activeFilter))
    .filter((h): h is NonNullable<typeof h> => h !== null);

  const ranked = rankSearchHits(hits);
  const answer = buildSearchAnswer(parsed, ranked, locale);

  return {
    query,
    parsedFilter: activeFilter,
    intents: parsed.intents,
    hits: ranked,
    answer,
    active: ranked.length > 0 || Boolean(answer),
  };
}

export function formatContextualSearchForPrompt(
  result: ContextualSearchResult,
): string {
  if (!result.active || !result.answer) return "";
  const lines = result.hits.slice(0, 3).map((h) => `- ${h.record.title}`);
  return `Contextual search (memory recall — informational):\nAnswer: ${result.answer.text}\nMatches:\n${lines.join("\n")}`;
}

export const SMART_SEARCH_FILTERS: SmartSearchFilter[] = [
  "unresolved",
  "urgent",
  "school",
  "doctor",
  "invoices",
  "promotions",
  "waiting_for_response",
];
