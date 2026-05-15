/** Extract plain + HTML bodies from Gmail MIME payloads. */

export type GmailMimePart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMimePart[];
};

export type ExtractedEmailBody = {
  bodyHtml: string;
  bodyPlain: string;
};

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function collectParts(
  part: GmailMimePart | undefined,
  htmlChunks: string[],
  plainChunks: string[],
): void {
  if (!part) return;

  const mime = (part.mimeType ?? "").toLowerCase();
  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (mime === "text/html" && decoded.trim()) {
      htmlChunks.push(decoded);
    } else if (mime === "text/plain" && decoded.trim()) {
      plainChunks.push(decoded);
    }
  }

  if (part.parts) {
    for (const child of part.parts) {
      collectParts(child, htmlChunks, plainChunks);
    }
  }
}

export function extractEmailBodyFromPayload(payload: GmailMimePart | undefined): ExtractedEmailBody {
  const htmlChunks: string[] = [];
  const plainChunks: string[] = [];

  if (!payload) {
    return { bodyHtml: "", bodyPlain: "" };
  }

  const rootMime = (payload.mimeType ?? "").toLowerCase();
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (rootMime === "text/html") htmlChunks.push(decoded);
    else if (rootMime === "text/plain") plainChunks.push(decoded);
    else if (decoded.includes("<html") || decoded.includes("<!DOCTYPE")) {
      htmlChunks.push(decoded);
    } else {
      plainChunks.push(decoded);
    }
  }

  collectParts(payload, htmlChunks, plainChunks);

  const bodyHtml = htmlChunks.sort((a, b) => b.length - a.length)[0] ?? "";
  const bodyPlain = plainChunks.sort((a, b) => b.length - a.length)[0] ?? "";

  return { bodyHtml, bodyPlain };
}

/** Rough plain text from HTML for reply context when Gmail has no text/plain part. */
export function htmlToPlainText(html: string): string {
  let t = html;
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>/gi, "\n\n");
  t = t.replace(/<\/div>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/gi, " ");
  t = t.replace(/&amp;/gi, "&");
  t = t.replace(/&lt;/gi, "<");
  t = t.replace(/&gt;/gi, ">");
  t = t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}
