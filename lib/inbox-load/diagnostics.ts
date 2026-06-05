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

export function logInboxLoadStart(diag: Pick<InboxLoadDiagnostics, "loadId" | "paginated" | "pageToken" | "append">): void {
  console.info("[inbox-load] start", {
    loadId: diag.loadId,
    paginated: diag.paginated,
    pageToken: diag.pageToken ?? null,
    append: diag.append ?? false,
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
    paginated: diag.paginated,
    append: diag.append ?? false,
    timings: diag.timings,
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
