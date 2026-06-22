import { loadVisitSnapshot, saveVisitSnapshot } from "@/lib/daily-briefing/visit-snapshot";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

const PREPARED_KEY = "handled:presence-prepared-at";

export type VisitFingerprintMessage = {
  id: string;
  internalDateMs?: number;
  date?: string;
};

export function hoursSinceLastVisit(now = Date.now()): number {
  const snapshot = loadVisitSnapshot();
  if (!snapshot?.visitedAt) return Infinity;
  return (now - snapshot.visitedAt) / (1000 * 60 * 60);
}

export function wasUserAway(thresholdHours = 1): boolean {
  return hoursSinceLastVisit() >= thresholdHours;
}

export function markInboxPrepared(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREPARED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function persistInboxVisit(
  messages: VisitFingerprintMessage[],
  counts: Record<InboxAiCategory, number>,
  waitingOnCount: number,
): void {
  const now = Date.now();
  const emailFingerprints: Record<string, number> = {};
  for (const m of messages) {
    let ms = m.internalDateMs ?? 0;
    if (!ms && m.date) {
      const t = new Date(m.date).getTime();
      if (!Number.isNaN(t)) ms = t;
    }
    emailFingerprints[m.id] = ms;
  }
  saveVisitSnapshot({
    visitedAt: now,
    counts: { ...counts, activeWaiting: waitingOnCount },
    emailFingerprints,
  });
}

export function shouldShowPresenceObservation(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return !sessionStorage.getItem("handled:presence-observation-shown");
  } catch {
    return true;
  }
}

export function markPresenceObservationShown(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("handled:presence-observation-shown", "1");
  } catch {
    /* ignore */
  }
}
