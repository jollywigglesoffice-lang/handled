import type { BrainEntry, BrainEntryCategory, HandledBrain } from "@/lib/handled-brain/types";
import type {
  KnowledgeChunk,
  KnowledgeMatchReason,
  KnowledgeRetrievalInput,
  ScoredKnowledgeChunk,
} from "@/lib/knowledge/types";

const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "from",
  "have",
  "that",
  "this",
  "with",
  "your",
  "would",
  "could",
  "should",
  "there",
  "their",
  "what",
  "when",
  "where",
  "which",
  "will",
  "thanks",
  "hello",
  "please",
  "email",
  "message",
  "handled",
]);

const TOPIC_SYNONYMS: Record<string, string[]> = {
  pricing: [
    "pricing",
    "price",
    "plan",
    "cost",
    "seat",
    "employee",
    "corporate",
    "enterprise",
    "tier",
    "quote",
    "discount",
    "subscription",
    "monthly",
    "annual",
  ],
  refund: ["refund", "return", "money back", "cancel", "cancellation", "chargeback"],
  policy: ["policy", "policies", "terms", "warranty", "guarantee"],
  support: ["support", "help", "issue", "bug", "broken", "not working"],
  scheduling: ["schedule", "meeting", "call", "calendar", "availability", "book"],
  family: ["seba", "school", "kid", "child", "family", "parent"],
  business: ["partnership", "collaborate", "integration", "demo", "sales"],
};

const INTENT_CATEGORY_BOOST: Record<string, BrainEntryCategory[]> = {
  pricing_inquiry: ["pricing", "business"],
  sales_lead: ["pricing", "business", "snippets"],
  information_request: ["pricing", "policies", "business", "faq"],
  support_request: ["policies", "business", "faq"],
  scheduling: ["calendar", "business", "personal"],
  partnership: ["business", "pricing"],
  direct_question: ["faq", "pricing", "policies"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function haystack(input: KnowledgeRetrievalInput): string {
  return `${input.subject ?? ""} ${input.emailText}`.toLowerCase();
}

function topicHits(hay: string, topic: string): number {
  const terms = TOPIC_SYNONYMS[topic] ?? [topic];
  let hits = 0;
  for (const term of terms) {
    if (hay.includes(term)) hits += 1;
  }
  return hits;
}

function scoreEntry(
  entry: BrainEntry,
  input: KnowledgeRetrievalInput,
): { score: number; matchReasons: KnowledgeMatchReason[] } {
  const hay = haystack(input);
  const reasons: KnowledgeMatchReason[] = [];
  let score = 0;

  const titleLower = entry.title.toLowerCase().trim();
  const blob = `${entry.title} ${entry.content}`.toLowerCase();
  const emailTokens = [...new Set(tokenize(hay))];
  const titleTokens = tokenize(titleLower);

  if (titleLower.length > 2 && hay.includes(titleLower)) {
    score += 12;
    reasons.push("title_match");
  }

  for (const tt of titleTokens) {
    if (hay.includes(tt)) {
      score += 4;
      if (!reasons.includes("title_match")) reasons.push("title_match");
    }
  }

  let keywordHits = 0;
  for (const t of emailTokens) {
    if (blob.includes(t)) {
      keywordHits += 1;
      score += 1.5;
    }
  }
  if (keywordHits >= 2) {
    reasons.push("keyword_overlap");
  }

  for (const [topic, terms] of Object.entries(TOPIC_SYNONYMS)) {
    const emailTopic = topicHits(hay, topic);
    if (emailTopic === 0) continue;
    const entryTopic = terms.some((term) => blob.includes(term));
    if (entryTopic) {
      score += 3 + emailTopic;
      if (!reasons.includes("semantic_topic")) reasons.push("semantic_topic");
    }
  }

  const intent = input.primaryIntent ?? "";
  const boosted = INTENT_CATEGORY_BOOST[intent] ?? [];
  if (boosted.includes(entry.category)) {
    score += 5;
    reasons.push("category_intent");
  }

  if (input.intentKinds?.includes("pricing_inquiry") && entry.category === "pricing") {
    score += 4;
    if (!reasons.includes("category_intent")) reasons.push("category_intent");
  }

  return { score, matchReasons: reasons };
}

export function brainEntriesToChunks(brain: HandledBrain): KnowledgeChunk[] {
  return brain.entries
    .filter((e) => e.content.trim().length > 0)
    .map((e) => ({
      id: e.id,
      source: "handled_brain" as const,
      title: e.title,
      content: e.content.trim(),
      category: e.category,
      updatedAt: e.updatedAt,
    }));
}

export function scoreHandledBrainEntries(
  brain: HandledBrain,
  input: KnowledgeRetrievalInput,
  options?: { maxResults?: number; minScore?: number },
): ScoredKnowledgeChunk[] {
  const maxResults = options?.maxResults ?? 5;
  const minScore = options?.minScore ?? 3;

  const scored = brain.entries
    .filter((e) => e.content.trim())
    .map((entry) => {
      const { score, matchReasons } = scoreEntry(entry, input);
      return {
        id: entry.id,
        source: "handled_brain" as const,
        title: entry.title,
        content: entry.content.trim(),
        category: entry.category,
        updatedAt: entry.updatedAt,
        score,
        matchReasons,
      } satisfies ScoredKnowledgeChunk;
    })
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return scored.slice(0, maxResults);
}
