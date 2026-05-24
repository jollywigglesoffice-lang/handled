/** Detect HTML without pulling in isomorphic-dompurify (safe for API route bundles). */
export function isLikelyHtml(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return true;
  if (/<\s*(div|table|p|span|body|center|td|tr|tbody|head)\b/i.test(t)) return true;
  if (/<[a-z][\s\S]*>/i.test(t) && t.includes("</")) return true;
  return false;
}
