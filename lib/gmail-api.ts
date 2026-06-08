/** Gmail REST helpers (server-side only — pass OAuth access token from Supabase session). */

import { GmailApiError } from "@/lib/gmail-api-error";
import {
  extractEmailBodyFromPayload,
  htmlToPlainText,
  type GmailMimePart,
} from "@/lib/gmail-extract-body";
import { formatGmailSender } from "@/lib/sender-identity";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailListItem = {
  id: string;
  threadId: string;
};

export type GmailListPage = {
  items: GmailListItem[];
  /** Pass to gmailListInboxPage to fetch the next page; null when no more. */
  nextPageToken: string | null;
};

/** Gmail system label for unread messages. */
export const GMAIL_UNREAD_LABEL = "UNREAD";

/** Gmail system label for the inbox. */
export const GMAIL_INBOX_LABEL = "INBOX";

export type GmailInboxLabelStats = {
  inboxTotal: number;
  unreadTotal: number;
};

/**
 * Official Gmail inbox totals from the Labels API (source of truth for reconciliation).
 */
export async function gmailGetInboxLabelStats(
  accessToken: string,
): Promise<GmailInboxLabelStats> {
  const url = `${GMAIL_BASE}/labels/${encodeURIComponent(GMAIL_INBOX_LABEL)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GmailApiError("Gmail label", res.status, text, {
      retryAfterHeader: res.headers.get("Retry-After"),
    });
  }

  const data = (await res.json()) as {
    messagesTotal?: number;
    messagesUnread?: number;
  };

  return {
    inboxTotal: typeof data.messagesTotal === "number" ? data.messagesTotal : 0,
    unreadTotal: typeof data.messagesUnread === "number" ? data.messagesUnread : 0,
  };
}

export function isGmailUnread(labelIds: string[] | undefined): boolean {
  return Boolean(labelIds?.includes(GMAIL_UNREAD_LABEL));
}

export type GmailInboxRow = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  internalDateMs: number;
  /** Gmail label ids on the message (includes UNREAD when unread). */
  labelIds?: string[];
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

/** @deprecated use formatGmailSender — kept for callers that import parseFrom */
function parseFrom(from: string): string {
  return formatGmailSender(from);
}

/**
 * Add/remove labels on one or more messages. Uses Gmail's batchModify so the
 * same call works for a single id or many (e.g. the UNREAD label for read-state).
 */
export async function gmailBatchModifyLabels(
  accessToken: string,
  ids: string[],
  labels: { add?: string[]; remove?: string[] },
): Promise<void> {
  if (ids.length === 0) return;

  const res = await fetch(`${GMAIL_BASE}/messages/batchModify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ids,
      addLabelIds: labels.add ?? [],
      removeLabelIds: labels.remove ?? [],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail batchModify failed: ${res.status} ${text}`);
  }
}

/**
 * List inbox message ids for one page. Returns the page items plus Gmail's
 * nextPageToken so callers can paginate (pass it back via options.pageToken).
 */
export async function gmailListInboxPage(
  accessToken: string,
  options?: { maxResults?: number; pageToken?: string | null },
): Promise<GmailListPage> {
  const maxResults = options?.maxResults ?? 200;
  const url = new URL(`${GMAIL_BASE}/messages`);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("q", "in:inbox");
  if (options?.pageToken) {
    url.searchParams.set("pageToken", options.pageToken);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GmailApiError("Gmail list", res.status, text, {
      retryAfterHeader: res.headers.get("Retry-After"),
    });
  }

  const data = (await res.json()) as {
    messages?: GmailListItem[];
    nextPageToken?: string;
  };
  return {
    items: data.messages ?? [],
    nextPageToken: data.nextPageToken ?? null,
  };
}

/** @deprecated use gmailListInboxPage (it also returns nextPageToken). */
export async function gmailListInboxIds(
  accessToken: string,
  maxResults = 20,
): Promise<GmailListItem[]> {
  const { items } = await gmailListInboxPage(accessToken, { maxResults });
  return items;
}

/**
 * Fetch metadata for many message ids with bounded concurrency. Fetching a full
 * inbox page (e.g. 200) all at once would open 200 simultaneous Gmail requests
 * and invite 429/rate-limit errors, so we cap in-flight requests. Results keep
 * the input order.
 */
export async function gmailGetMessagesMetadata(
  accessToken: string,
  ids: string[],
  concurrency = 15,
): Promise<GmailInboxRow[]> {
  const rows = new Array<GmailInboxRow>(ids.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      rows[index] = await gmailGetMessageMetadata(accessToken, ids[index]);
    }
  }

  const poolSize = Math.min(Math.max(concurrency, 1), ids.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return rows;
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
    labelIds?: string[];
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

  const labelIds = Array.isArray(msg.labelIds)
    ? msg.labelIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : undefined;

  return {
    id: msg.id,
    threadId: msg.threadId ?? msg.id,
    sender: from,
    subject,
    snippet: msg.snippet ?? "",
    date,
    internalDateMs: Number.isNaN(internalMs) ? 0 : internalMs,
    labelIds,
    listUnsubscribe: headerValue(headers, "List-Unsubscribe") || undefined,
    listUnsubscribePost: headerValue(headers, "List-Unsubscribe-Post") || undefined,
  };
}

export async function gmailGetMessageFull(
  accessToken: string,
  messageId: string,
): Promise<{
  id: string;
  threadId: string;
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
    threadId?: string;
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
    threadId: msg.threadId ?? msg.id,
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
