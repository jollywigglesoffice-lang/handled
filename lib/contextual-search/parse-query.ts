import type { SearchIntent, SmartSearchFilter } from "@/lib/contextual-search/types";
import { tokenizeSearchText } from "@/lib/contextual-search/tokenize";

export type ParsedSearchQuery = {
  raw: string;
  tokens: string[];
  inferredFilter?: SmartSearchFilter;
  personTokens: string[];
  intents: SearchIntent[];
};

const FILTER_PATTERNS: Array<{ filter: SmartSearchFilter; re: RegExp }> = [
  { filter: "unresolved", re: /\b(unresolved|open thread|show unresolved|follow-?ups?)\b/i },
  {
    filter: "waiting_for_response",
    re: /\b(waiting for (?:a )?response|waiting on|awaiting (?:their|his|her) reply)\b/i,
  },
  { filter: "urgent", re: /\b(urgent|asap|time.?sensitive)\b/i },
  { filter: "school", re: /\b(school|scuola|teacher|field trip|alexandria|seba)\b/i },
  { filter: "doctor", re: /\b(doctor|clinic|pediatric|medical|healthcare)\b/i },
  { filter: "invoices", re: /\b(invoice|invoices|billing|shopify|stripe|fattura)\b/i },
  { filter: "promotions", re: /\b(promotion|promotions|marketing|unsubscribe)\b/i },
];

function extractPersonTokens(q: string, tokens: string[]): string[] {
  const names: string[] = [];
  const replyMatch = q.match(
    /\b(?:did|has|have)\s+([A-Z][a-z]+)\s+(?:reply|replied|respond)/i,
  );
  if (replyMatch?.[1]) names.push(replyMatch[1].toLowerCase());

  const whatMatch = q.match(
    /\bwhat did\s+([A-Za-z]+(?:'s)?)\s+(?:school|say)/i,
  );
  if (whatMatch?.[1]) {
    names.push(whatMatch[1].replace(/'s$/i, "").toLowerCase());
  }

  return [...new Set(names)].slice(0, 3);
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const trimmed = raw.trim();
  const tokens = tokenizeSearchText(trimmed);
  const intents: SearchIntent[] = [];

  let inferredFilter: SmartSearchFilter | undefined;
  for (const { filter, re } of FILTER_PATTERNS) {
    if (re.test(trimmed)) {
      inferredFilter = filter;
      break;
    }
  }

  if (/\b(did|has|have).{0,30}(reply|replied|respond)\b/i.test(trimmed)) {
    intents.push("reply_check");
  }
  if (/\bwhat did\b/i.test(trimmed) || /\bsay about\b/i.test(trimmed)) {
    intents.push("find_mention");
  }
  if (/\b(unresolved|follow-?up)\b/i.test(trimmed)) {
    intents.push("list_follow_ups");
  }
  if (!intents.length) intents.push("general");

  return {
    raw: trimmed,
    tokens,
    inferredFilter,
    personTokens: extractPersonTokens(trimmed, tokens),
    intents,
  };
}
