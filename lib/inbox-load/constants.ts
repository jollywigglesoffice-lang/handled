/** First inbox open — full page for categorization coverage. */
export const INBOX_INITIAL_PAGE_SIZE = 200;

/** Silent refresh / poll — newest slice only. */
export const INBOX_REFRESH_PAGE_SIZE = 40;

/** Load-more pagination page size. */
export const INBOX_LOAD_MORE_PAGE_SIZE = 200;

/** Auto-refresh interval while inbox is visible (was 3 min). */
export const INBOX_AUTO_REFRESH_MS = 10 * 60 * 1000;

export const INBOX_BACKOFF_BASE_MS = 30_000;
export const INBOX_BACKOFF_MAX_MS = 5 * 60 * 1000;

export const INBOX_CACHE_KEY = "handled_inbox_cache_v1";
