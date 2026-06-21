/** Extract plain + HTML bodies from Gmail MIME payloads. */

import { isLikelyHtml } from "@/lib/is-likely-html";

export type GmailMimePart = {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
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

function mimeBase(mimeType: string | undefined): string {
  return (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function classifyDecodedBody(mime: string, decoded: string): "html" | "plain" | null {
  const text = decoded.trim();
  if (!text) return null;
  if (mime === "text/html" || mime === "text/xhtml") return "html";
  if (mime === "text/plain") return "plain";
  if (text.includes("<html") || text.includes("<!DOCTYPE") || isLikelyHtml(text)) return "html";
  return "plain";
}

function pushDecoded(
  mime: string,
  decoded: string,
  htmlChunks: string[],
  plainChunks: string[],
): void {
  const kind = classifyDecodedBody(mime, decoded);
  if (kind === "html") htmlChunks.push(decoded);
  else if (kind === "plain") plainChunks.push(decoded);
}

function collectParts(
  part: GmailMimePart | undefined,
  htmlChunks: string[],
  plainChunks: string[],
): void {
  if (!part) return;

  const mime = mimeBase(part.mimeType);
  if (part.body?.data) {
    pushDecoded(mime, decodeBase64Url(part.body.data), htmlChunks, plainChunks);
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

  const rootMime = mimeBase(payload.mimeType);
  if (payload.body?.data) {
    pushDecoded(rootMime, decodeBase64Url(payload.body.data), htmlChunks, plainChunks);
  }

  collectParts(payload, htmlChunks, plainChunks);

  const bodyHtml = htmlChunks.sort((a, b) => b.length - a.length)[0] ?? "";
  const bodyPlain = plainChunks.sort((a, b) => b.length - a.length)[0] ?? "";

  return { bodyHtml, bodyPlain };
}

export type AttachmentBodyFetcher = (
  attachmentId: string,
) => Promise<string | null>;

async function collectPartsAsync(
  part: GmailMimePart | undefined,
  htmlChunks: string[],
  plainChunks: string[],
  fetchAttachment: AttachmentBodyFetcher,
): Promise<void> {
  if (!part) return;

  const mime = mimeBase(part.mimeType);
  if (part.body?.data) {
    pushDecoded(mime, decodeBase64Url(part.body.data), htmlChunks, plainChunks);
  } else if (part.body?.attachmentId) {
    const raw = await fetchAttachment(part.body.attachmentId);
    if (raw) {
      pushDecoded(mime, decodeBase64Url(raw), htmlChunks, plainChunks);
    }
  }

  if (part.parts) {
    for (const child of part.parts) {
      await collectPartsAsync(child, htmlChunks, plainChunks, fetchAttachment);
    }
  }
}

/** Like extractEmailBodyFromPayload but resolves Gmail attachmentId body references. */
export async function extractEmailBodyFromPayloadAsync(
  payload: GmailMimePart | undefined,
  fetchAttachment: AttachmentBodyFetcher,
): Promise<ExtractedEmailBody> {
  const htmlChunks: string[] = [];
  const plainChunks: string[] = [];

  if (!payload) {
    return { bodyHtml: "", bodyPlain: "" };
  }

  const rootMime = mimeBase(payload.mimeType);
  if (payload.body?.data) {
    pushDecoded(rootMime, decodeBase64Url(payload.body.data), htmlChunks, plainChunks);
  } else if (payload.body?.attachmentId) {
    const raw = await fetchAttachment(payload.body.attachmentId);
    if (raw) {
      pushDecoded(rootMime, decodeBase64Url(raw), htmlChunks, plainChunks);
    }
  }

  await collectPartsAsync(payload, htmlChunks, plainChunks, fetchAttachment);

  const bodyHtml = htmlChunks.sort((a, b) => b.length - a.length)[0] ?? "";
  const bodyPlain = plainChunks.sort((a, b) => b.length - a.length)[0] ?? "";

  return { bodyHtml, bodyPlain };
}

/** Resolve displayable plain text + HTML with snippet fallback — never returns empty body when snippet exists. */
export function resolveEmailDisplayBody(input: {
  bodyPlain: string;
  bodyHtml: string;
  snippet: string;
}): { bodyText: string; bodyHtml: string } {
  const plain = input.bodyPlain.trim();
  const html = input.bodyHtml.trim();
  const snippet = input.snippet.trim();

  let bodyText = "";
  if (plain && !isLikelyHtml(plain)) {
    bodyText = plain;
  } else if (html) {
    bodyText = htmlToPlainText(html);
  } else if (plain) {
    bodyText = plain;
  }

  if (!bodyText.trim()) {
    bodyText = snippet;
  }

  const resolvedHtml =
    html || (plain && isLikelyHtml(plain) ? plain : "");

  return { bodyText, bodyHtml: resolvedHtml };
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
