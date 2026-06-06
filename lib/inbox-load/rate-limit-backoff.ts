import {
  INBOX_BACKOFF_BASE_MS,
  INBOX_BACKOFF_MAX_MS,
} from "@/lib/inbox-load/constants";

export type RateLimitBackoffState = {
  consecutive429Count: number;
  backoffUntil: number;
  lastRetryAfterMs: number | null;
  lastBackoffDelayMs: number;
};

const STORAGE_KEY = "handled_inbox_rate_limit_v1";

function defaultState(): RateLimitBackoffState {
  return {
    consecutive429Count: 0,
    backoffUntil: 0,
    lastRetryAfterMs: null,
    lastBackoffDelayMs: 0,
  };
}

function loadState(): RateLimitBackoffState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<RateLimitBackoffState>;
    return {
      consecutive429Count: parsed.consecutive429Count ?? 0,
      backoffUntil: parsed.backoffUntil ?? 0,
      lastRetryAfterMs: parsed.lastRetryAfterMs ?? null,
      lastBackoffDelayMs: parsed.lastBackoffDelayMs ?? 0,
    };
  } catch {
    return defaultState();
  }
}

function saveState(state: RateLimitBackoffState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

let memoryState = defaultState();

function getState(): RateLimitBackoffState {
  if (typeof window !== "undefined") {
    memoryState = loadState();
  }
  return memoryState;
}

/** Parse Retry-After header (seconds) or Gmail error body hints. */
export function parseRetryAfterMs(
  status: number,
  body?: string,
  retryAfterHeader?: string | null,
): number | null {
  if (status !== 429) return null;

  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader);
    if (Number.isFinite(secs) && secs > 0) return secs * 1000;
  }

  if (body) {
    const retryMatch = body.match(/retry(?:\s+after)?[:\s]+(\d+)/i);
    if (retryMatch?.[1]) {
      const secs = Number(retryMatch[1]);
      if (Number.isFinite(secs) && secs > 0) return secs * 1000;
    }
  }

  return null;
}

export function computeBackoffDelayMs(
  consecutive429Count: number,
  retryAfterMs?: number | null,
): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, INBOX_BACKOFF_MAX_MS);
  }
  const exp = INBOX_BACKOFF_BASE_MS * 2 ** Math.max(0, consecutive429Count - 1);
  return Math.min(exp, INBOX_BACKOFF_MAX_MS);
}

export function isInboxLoadBackoffActive(now = Date.now()): boolean {
  return getState().backoffUntil > now;
}

export function msUntilBackoffEnds(now = Date.now()): number {
  return Math.max(0, getState().backoffUntil - now);
}

export function recordInboxRateLimit(input?: {
  retryAfterMs?: number | null;
  source?: string;
}): RateLimitBackoffState {
  const prev = getState();
  const consecutive429Count = prev.consecutive429Count + 1;
  const backoffDelayMs = computeBackoffDelayMs(consecutive429Count, input?.retryAfterMs);
  const next: RateLimitBackoffState = {
    consecutive429Count,
    backoffUntil: Date.now() + backoffDelayMs,
    lastRetryAfterMs: input?.retryAfterMs ?? null,
    lastBackoffDelayMs: backoffDelayMs,
  };
  memoryState = next;
  saveState(next);

  console.warn("[inbox-load] Gmail rate limit — backing off", {
    consecutive429Count,
    retryAfterMs: input?.retryAfterMs ?? null,
    backoffDelayMs,
    backoffUntil: new Date(next.backoffUntil).toISOString(),
    source: input?.source ?? "unknown",
  });

  return next;
}

export function resetInboxRateLimitBackoff(): void {
  memoryState = defaultState();
  saveState(memoryState);
}

export function getInboxRateLimitState(): RateLimitBackoffState {
  return getState();
}
