/** Extract stable topic keywords from subject for category pattern memory. */
export function extractTopicKeywords(subject: string, max = 2): string[] {
  const stop = new Set([
    "re",
    "fw",
    "fwd",
    "the",
    "a",
    "an",
    "your",
    "my",
    "our",
    "for",
    "and",
    "to",
    "from",
    "via",
    "update",
    "reminder",
    "notification",
  ]);

  const words = subject
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));

  return [...new Set(words)].slice(0, max);
}
