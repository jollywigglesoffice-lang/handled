const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "did",
  "find",
  "from",
  "have",
  "show",
  "that",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
  "email",
  "emails",
  "mentioning",
  "mentions",
  "said",
  "reply",
  "replied",
  "good_to_know",
]);

export function tokenizeSearchText(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/['']/g, "'")
        .split(/\W+/)
        .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
    ),
  ];
}

export function haystackForRecord(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}
