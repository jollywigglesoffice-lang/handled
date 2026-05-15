import DOMPurify from "isomorphic-dompurify";

const EMAIL_ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const EMAIL_ALLOWED_ATTR = [
  "href",
  "title",
  "alt",
  "src",
  "width",
  "height",
  "colspan",
  "rowspan",
  "align",
  "valign",
  "border",
  "cellpadding",
  "cellspacing",
  "class",
  "style",
];

/** Strip tracking pixels and obvious template noise before sanitize. */
function preprocessEmailHtml(raw: string): string {
  let html = raw;
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "");
  html = html.replace(/<embed[^>]*>/gi, "");
  html = html.replace(/<link[^>]*>/gi, "");
  html = html.replace(/<meta[^>]*>/gi, "");
  html = html.replace(/<img[^>]+width=["']?1["']?[^>]*height=["']?1["']?[^>]*>/gi, "");
  html = html.replace(/<img[^>]+height=["']?1["']?[^>]*width=["']?1["']?[^>]*>/gi, "");
  return html;
}

export function sanitizeEmailHtml(rawHtml: string): string {
  if (!rawHtml?.trim()) return "";

  const preprocessed = preprocessEmailHtml(rawHtml);

  const clean = DOMPurify.sanitize(preprocessed, {
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["form", "input", "button", "textarea", "select", "style", "link", "base"],
    FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
  });

  return clean;
}

export function isLikelyHtml(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return true;
  if (/<\s*(div|table|p|span|body|center|td|tr|tbody|head)\b/i.test(t)) return true;
  if (/<[a-z][\s\S]*>/i.test(t) && t.includes("</")) return true;
  return false;
}
