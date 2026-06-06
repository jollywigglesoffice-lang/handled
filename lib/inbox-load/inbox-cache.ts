import { INBOX_CACHE_KEY } from "@/lib/inbox-load/constants";

export type InboxCacheSnapshot = {
  savedAt: number;
  gmailMessages: unknown[];
  categoryOverrides: Record<string, string>;
  nextPageToken: string | null;
  lastSyncedAt: string | null;
};

export function saveInboxCache(snapshot: InboxCacheSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INBOX_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function loadInboxCache(): InboxCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INBOX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InboxCacheSnapshot;
    if (!Array.isArray(parsed.gmailMessages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasInboxCache(): boolean {
  return hasValidInboxCache();
}

/** True when a prior successful load was saved with at least one message. */
export function hasValidInboxCache(): boolean {
  const cache = loadInboxCache();
  return Boolean(cache?.gmailMessages.length);
}
