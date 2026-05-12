/** Gmail REST helpers (server-side only — pass OAuth access token from Supabase session). */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailListItem = {
  id: string;
  threadId: string;
};

export type GmailInboxRow = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  internalDateMs: number;
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
  const url = `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;

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
    sender: from,
    subject,
    snippet: msg.snippet ?? "",
    date,
    internalDateMs: Number.isNaN(internalMs) ? 0 : internalMs,
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
  internalDateMs: number;
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

  type GmailPart = {
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };

  const msg = (await res.json()) as {
    id: string;
    snippet?: string;
    internalDate?: string;
    payload?: {
      headers?: Array<{ name?: string; value?: string }>;
      body?: { data?: string };
      parts?: GmailPart[];
    };
  };

  const headers = msg.payload?.headers;
  const sender = parseFrom(headerValue(headers, "From"));
  const subject = headerValue(headers, "Subject") || "(No subject)";
  const internalMs = msg.internalDate ? Number(msg.internalDate) : 0;

  function extractPlain(parts: GmailPart[] | undefined): string {
    if (!parts) return "";
    for (const p of parts) {
      if (p.mimeType === "text/plain" && p.body?.data) {
        return decodeBase64Url(p.body.data);
      }
      if (p.parts) {
        const nested = extractPlain(p.parts);
        if (nested) return nested;
      }
    }
    return "";
  }

  let bodyText = "";
  if (msg.payload?.body?.data) {
    bodyText = decodeBase64Url(msg.payload.body.data);
  } else {
    bodyText = extractPlain(msg.payload?.parts);
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
    internalDateMs: internalMs,
  };
}
