import type {
  InboxLoadDiagnostics,
  InboxLoadFailureReason,
  InboxLoadStage,
  InboxLoadTimings,
} from "@/lib/inbox-load/types";
import { INBOX_LOAD_SLOW_THRESHOLD_MS } from "@/lib/inbox-load/types";

export function createInboxLoadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return `load-${Date.now().toString(36)}`;
}

export function logInboxLoadStart(
  diag: Pick<InboxLoadDiagnostics, "loadId" | "paginated" | "pageToken" | "append" | "refresh">,
): void {
  console.info("[inbox-load] start", {
    loadId: diag.loadId,
    paginated: diag.paginated,
    pageToken: diag.pageToken ?? null,
    append: diag.append ?? false,
    refresh: diag.refresh ?? false,
  });
}

export function logInboxLoadComplete(
  diag: InboxLoadDiagnostics & { emailCount: number },
): void {
  const payload = {
    loadId: diag.loadId,
    durationMs: diag.timings.totalMs,
    emailCount: diag.emailCount,
    paginated: diag.paginated,
    append: diag.append ?? false,
    timings: diag.timings,
  };

  if (diag.timings.totalMs && diag.timings.totalMs >= INBOX_LOAD_SLOW_THRESHOLD_MS) {
    console.warn("[inbox-load] Slow inbox load", {
      ...payload,
      thresholdMs: INBOX_LOAD_SLOW_THRESHOLD_MS,
    });
  } else {
    console.info("[inbox-load] complete", payload);
  }
}

export function logInboxLoadFailed(
  diag: InboxLoadDiagnostics & {
    failureReason: InboxLoadFailureReason;
    failureStage: InboxLoadStage;
  },
): void {
  console.error("[inbox-load] failed", {
    loadId: diag.loadId,
    failureReason: diag.failureReason,
    failureStage: diag.failureStage,
    durationMs: diag.timings.totalMs,
    gmailStatus: diag.gmailStatus ?? null,
    gmailReason: diag.gmailReason ?? null,
    retryAfterMs: diag.retryAfterMs ?? null,
    backoffDelayMs: diag.backoffDelayMs ?? null,
    consecutive429Count: diag.consecutive429Count ?? null,
    paginated: diag.paginated,
    append: diag.append ?? false,
    refresh: diag.refresh ?? false,
    timings: diag.timings,
  });
}

export function logInboxApiError(input: {
  endpoint: string;
  httpStatus: number;
  accountId?: string | null;
  failureReason: InboxLoadFailureReason;
  failureStage: InboxLoadStage;
  errorBody?: unknown;
  loadId?: string;
  cause?: unknown;
}): void {
  console.error("[inbox-load] API error", {
    endpoint: input.endpoint,
    httpStatus: input.httpStatus,
    accountId: input.accountId ?? null,
    failureReason: input.failureReason,
    failureStage: input.failureStage,
    loadId: input.loadId ?? null,
    errorBody: input.errorBody,
    cause:
      input.cause instanceof Error
        ? { name: input.cause.name, message: input.cause.message }
        : input.cause ?? null,
  });
}

export function mergeTimings(
  base: InboxLoadTimings,
  ...patches: Array<Partial<InboxLoadTimings> | undefined>
): InboxLoadTimings {
  let merged = { ...base };
  for (const patch of patches) {
    if (patch) merged = { ...merged, ...patch };
  }
  return merged;
}

export function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt;
}
