/** Split "Seba, Sebastiano, ospedale" → ["seba", "sebastiano", "ospedale"] */
export function parseKeywordList(value: string): string[] {
  return value
    .split(/[,;|\n]+/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

export function haystackMatchesAnyKeyword(haystack: string, value: string): boolean {
  const keywords = parseKeywordList(value);
  if (keywords.length === 0) return false;
  const hay = haystack.toLowerCase();
  return keywords.some((kw) => hay.includes(kw));
}
