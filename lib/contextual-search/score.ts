import type { ParsedSearchQuery } from "@/lib/contextual-search/parse-query";
import { haystackForRecord, tokenizeSearchText } from "@/lib/contextual-search/tokenize";
import { recordMatchesFilter } from "@/lib/contextual-search/filters";
import type {
  ContextualSearchHit,
  MemoryRecord,
  SmartSearchFilter,
} from "@/lib/contextual-search/types";

const SOURCE_BOOST: Partial<Record<MemoryRecord["source"], number>> = {
  email: 4,
  email_summary: 5,
  follow_up: 6,
  timeline: 5,
  reminder: 5,
  handled_brain: 3,
  relationship: 2,
};

function senderMatchesPerson(sender: string | undefined, person: string): boolean {
  if (!sender) return false;
  return sender.toLowerCase().includes(person);
}

export function scoreMemoryRecord(
  record: MemoryRecord,
  parsed: ParsedSearchQuery,
  activeFilter?: SmartSearchFilter | null,
): ContextualSearchHit | null {
  const filter = activeFilter ?? parsed.inferredFilter;
  if (filter && !recordMatchesFilter(record, filter)) {
    return null;
  }

  const hay = haystackForRecord([
    record.title,
    record.body,
    record.sender,
    record.subject,
    record.timelineSummary,
  ]);

  const reasons: string[] = [];
  let score = 0;

  if (!parsed.tokens.length && !filter) {
    return null;
  }

  if (parsed.raw.length > 2 && hay.includes(parsed.raw.toLowerCase())) {
    score += 20;
    reasons.push("phrase_match");
  }

  let tokenHits = 0;
  for (const t of parsed.tokens) {
    if (hay.includes(t)) {
      tokenHits += 1;
      score += 3;
    }
  }
  if (tokenHits >= 2) reasons.push("keyword_overlap");
  if (tokenHits === 0 && parsed.tokens.length > 0 && !filter) {
    return null;
  }

  for (const person of parsed.personTokens) {
    if (senderMatchesPerson(record.sender, person) || hay.includes(person)) {
      score += 8;
      reasons.push("person_match");
    }
  }

  if (parsed.intents.includes("reply_check")) {
    if (record.followUpState === "waiting_for_response") {
      score += 10;
      reasons.push("waiting_on_them");
    }
    if (record.followUpState === "awaiting_your_reply") {
      score += 6;
      reasons.push("awaiting_you");
    }
  }

  if (parsed.intents.includes("list_follow_ups") && record.source === "follow_up") {
    score += 8;
    reasons.push("follow_up");
  }

  if (filter && record.filters.includes(filter)) {
    score += 6;
    reasons.push("filter_match");
  }

  score += SOURCE_BOOST[record.source] ?? 0;

  if (record.urgencyScore) {
    score += Math.min(8, record.urgencyScore * 0.08);
  }

  const ms = record.internalDateMs ?? 0;
  if (ms > 0) {
    const days = (Date.now() - ms) / 86400000;
    if (days <= 3) score += 4;
    else if (days <= 14) score += 2;
  }

  if (score < 4 && !filter) return null;

  const snippetHighlight = highlightSnippet(record.body, parsed.tokens);

  return {
    record,
    score,
    matchReasons: reasons,
    snippetHighlight,
  };
}

function highlightSnippet(body: string, tokens: string[]): string | undefined {
  const line = body.split("\n").find((l) => tokens.some((t) => l.toLowerCase().includes(t)));
  if (!line) return body.slice(0, 140).trim() || undefined;
  return line.slice(0, 160).trim();
}

export function rankSearchHits(
  hits: ContextualSearchHit[],
  max = 12,
): ContextualSearchHit[] {
  return [...hits]
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.record.internalDateMs ?? 0) - (a.record.internalDateMs ?? 0),
    )
    .slice(0, max);
}
