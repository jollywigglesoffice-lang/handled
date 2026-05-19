/** Gmail REST helpers (server-side only — pass OAuth access token from Supabase session). */

import {
  extractEmailBodyFromPayload,
  htmlToPlainText,
  type GmailMimePart,
} from "@/lib/gmail-extract-body";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailListItem = {
  id: string;
  threadId: string;
};

export type GmailInboxRow = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  internalDateMs: number;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
};

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string {
  if (!headers) return "";
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value?.trim() ?? "";
}

function parseFrom(from: string): string {
  if (!from) return "Unknown sender";
  const m = from.match(/^"?([^"<]+)"?\s*<[^>]+>/);
  if (m?.[1]) return m[1].trim();
  const emailOnly = from.match(/<([^>]+)>/);
  if (emailOnly?.[1]) return emailOnly[1].trim();
  return from;
}

export async function gmailListInboxIds(
  accessToken: string,
  maxResults = 20,
): Promise<GmailListItem[]> {
  const url = new URL(`${GMAIL_BASE}/messages`);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("q", "in:inbox");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail list failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { messages?: GmailListItem[] };
  return data.messages ?? [];
}

export async function gmailGetMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<GmailInboxRow> {
  const url = `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail get failed: ${res.status} ${text}`);
  }

  const msg = (await res.json()) as {
    id: string;
    threadId?: string;
    snippet?: string;
    internalDate?: string;
    payload?: { headers?: Array<{ name?: string; value?: string }> };
  };

  const headers = msg.payload?.headers;
  const from = parseFrom(headerValue(headers, "From"));
  const subject = headerValue(headers, "Subject") || "(No subject)";
  const dateHeader = headerValue(headers, "Date");
  const internalMs = msg.internalDate ? Number(msg.internalDate) : NaN;
  const date =
    !Number.isNaN(internalMs) && internalMs > 0
      ? new Date(internalMs).toISOString()
      : dateHeader || "";

  return {
    id: msg.id,
    threadId: msg.threadId ?? msg.id,
    sender: from,
    subject,
    snippet: msg.snippet ?? "",
    date,
    internalDateMs: Number.isNaN(internalMs) ? 0 : internalMs,
    listUnsubscribe: headerValue(headers, "List-Unsubscribe") || undefined,
    listUnsubscribePost: headerValue(headers, "List-Unsubscribe-Post") || undefined,
  };
}

export async function gmailGetMessageFull(
  accessToken: string,
  messageId: string,
): Promise<{
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  internalDateMs: number;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
}> {
  const url = `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}?format=full`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail get full failed: ${res.status} ${text}`);
  }

  const msg = (await res.json()) as {
    id: string;
    snippet?: string;
    internalDate?: string;
    payload?: GmailMimePart & {
      headers?: Array<{ name?: string; value?: string }>;
    };
  };

  const headers = msg.payload?.headers;
  const sender = parseFrom(headerValue(headers, "From"));
  const subject = headerValue(headers, "Subject") || "(No subject)";
  const internalMs = msg.internalDate ? Number(msg.internalDate) : 0;

  const { bodyHtml, bodyPlain } = extractEmailBodyFromPayload(msg.payload);

  let bodyText = bodyPlain.trim();
  if (!bodyText && bodyHtml.trim()) {
    bodyText = htmlToPlainText(bodyHtml);
  }
  if (!bodyText.trim()) {
    bodyText = msg.snippet ?? "";
  }

  return {
    id: msg.id,
    sender,
    subject,
    snippet: msg.snippet ?? "",
    bodyText,
    bodyHtml: bodyHtml.trim(),
    internalDateMs: internalMs,
    listUnsubscribe: headerValue(headers, "List-Unsubscribe") || undefined,
    listUnsubscribePost: headerValue(headers, "List-Unsubscribe-Post") || undefined,
  };
}

/** RFC 8058 one-click POST to List-Unsubscribe HTTPS URL (no OAuth — sender endpoint only). */
export async function performOneClickUnsubscribe(
  httpsUrl: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(httpsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Handled/1.0 (unsubscribe-assistant)",
      },
      body: "List-Unsubscribe=One-Click",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status };
    }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "request_failed",
    };
  }
}
