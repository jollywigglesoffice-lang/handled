import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { DailyBriefingMessage } from "@/lib/daily-briefing/types";

const STORAGE_KEY = "handled_inbox_visit_snapshot_v1";

export type InboxVisitSnapshot = {
  visitedAt: number;
  counts: {
    worth_your_attention: number;
    waiting_on: number;
    fyi: number;
    promotion: number;
    waitingOn: number;
  };
  /** emailId → internalDateMs at last visit */
  emailFingerprints: Record<string, number>;
};

function messageMs(m: DailyBriefingMessage): number {
  if (typeof m.internalDateMs === "number" && m.internalDateMs > 0) return m.internalDateMs;
  if (m.date) {
    const t = new Date(m.date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

export function buildVisitSnapshot(
  messages: DailyBriefingMessage[],
  counts: Record<InboxAiCategory, number>,
  waitingOnCount: number,
  now = Date.now(),
): InboxVisitSnapshot {
  const emailFingerprints: Record<string, number> = {};
  for (const m of messages) {
    emailFingerprints[m.id] = messageMs(m);
  }

  return {
    visitedAt: now,
    counts: {
      worth_your_attention: counts.worth_your_attention ?? 0,
      waiting_on: waitingOnCount,
      fyi: counts.good_to_know ?? 0,
      promotion: counts.promotions ?? 0,
      waitingOn: waitingOnCount,
    },
    emailFingerprints,
  };
}

export function loadVisitSnapshot(): InboxVisitSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InboxVisitSnapshot;
    if (!parsed || typeof parsed.visitedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveVisitSnapshot(snapshot: InboxVisitSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function isEmailNewSinceVisit(
  emailId: string,
  internalDateMs: number,
  snapshot: InboxVisitSnapshot | null,
): boolean {
  if (!snapshot) return true;
  const prev = snapshot.emailFingerprints[emailId];
  if (prev == null) return true;
  if (internalDateMs > snapshot.visitedAt) return true;
  return internalDateMs > prev;
}
