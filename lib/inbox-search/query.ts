import { isGmailUnread } from "@/lib/gmail-api";
import { scopedEmailKey } from "@/lib/gmail/account-types";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import type { InboxSearchFilters, InboxSearchReadFilter } from "@/lib/inbox-search/types";

/** Build searchable haystack for local inbox filter (subject, sender, body preview). */
export function buildInboxSearchHaystack(message: {
  sender: string;
  subject: string;
  snippet: string;
  bodyPlain?: string;
  body?: string;
  summary?: string;
}): string {
  return [
    message.sender,
    message.subject,
    message.snippet,
    message.bodyPlain ?? "",
    message.body ?? "",
    message.summary ?? "",
  ]
    .join(" ")
    .trim();
}

/** Build a Gmail API search query (full-text across subject, sender, body). Excludes spam/trash. */
export function buildGmailSearchQuery(
  userQuery: string,
  read: InboxSearchReadFilter = "all",
): string {
  const trimmed = userQuery.trim();
  const parts = ["-in:spam", "-in:trash"];
  if (read === "unread") parts.push("is:unread");
  if (read === "read") parts.push("-is:unread");
  if (trimmed) {
    // Gmail full-text: plain terms search subject, body, and sender.
    // Quote multi-word phrases so Gmail treats them as one unit.
    const gmailTerm = /\s/.test(trimmed) ? `"${trimmed.replace(/"/g, "")}"` : trimmed;
    parts.push(gmailTerm);
  }
  return parts.join(" ");
}

export function resolveMessageUnread(
  message: { id: string; accountId?: string; labelIds?: string[] },
  readMap: ReadStateMap,
): boolean {
  const scoped = scopedEmailKey(message.id, message.accountId);
  const explicit =
    readMap[scoped] ?? readMap[message.id];
  if (explicit === "unread") return true;
  if (explicit === "read") return false;
  return isGmailUnread(message.labelIds);
}

export function matchesInboxSearchText(
  haystack: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

export function matchesInboxSearchFilters<
  T extends {
    id: string;
    sender: string;
    subject: string;
    snippet: string;
    category: string;
    accountId?: string;
    labelIds?: string[];
    bodyPlain?: string;
    body?: string;
    summary?: string;
  },
>(message: T, filters: InboxSearchFilters, readMap: ReadStateMap): boolean {
  const q = filters.query.trim();
  if (q.length >= 2) {
    const hay = buildInboxSearchHaystack(message);
    if (!matchesInboxSearchText(hay, q)) return false;
  }

  if (filters.category !== "all" && message.category !== filters.category) {
    return false;
  }

  if (filters.accountId !== "all" && message.accountId !== filters.accountId) {
    return false;
  }

  if (filters.read === "unread" && !resolveMessageUnread(message, readMap)) {
    return false;
  }
  if (filters.read === "read" && resolveMessageUnread(message, readMap)) {
    return false;
  }

  return true;
}
