/** Parse RFC 2369 List-Unsubscribe header value into mailto + https URLs. */
export function parseListUnsubscribeHeader(value: string): {
  mailto: string[];
  https: string[];
} {
  const mailto: string[] = [];
  const https: string[] = [];
  const trimmed = value.trim();
  if (!trimmed) return { mailto, https };

  const angle = trimmed.match(/<([^>]+)>/g) ?? [];
  for (const raw of angle) {
    const inner = raw.slice(1, -1).trim();
    if (inner.toLowerCase().startsWith("mailto:")) {
      mailto.push(inner.slice(7).split("?")[0]?.trim() ?? inner);
    } else if (/^https?:\/\//i.test(inner)) {
      https.push(inner);
    }
  }

  return { mailto, https };
}

export function supportsOneClickPost(listUnsubscribePost: string | undefined): boolean {
  if (!listUnsubscribePost?.trim()) return false;
  return /list-unsubscribe\s*=\s*one-click/i.test(listUnsubscribePost);
}
