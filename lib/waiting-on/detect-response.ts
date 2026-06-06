import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { isActiveWaiting } from "@/lib/waiting-on/helpers";
import { isSenderUser } from "@/lib/waiting-on/is-from-user";

export type InboxMessageForWaitingDetect = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet?: string;
  internalDateMs?: number;
  date?: string;
};

export type WaitingResponseDetection = {
  responseEmailId: string;
  responseSender: string;
  responseSubject: string;
  responseSnippet?: string;
  responseAt: number;
  threadId: string;
};

export type WaitingDetectOptions = {
  /** Authenticated Gmail address — replies from this sender are ignored. */
  userEmail?: string | null;
};

function messageMs(m: InboxMessageForWaitingDetect): number {
  if (typeof m.internalDateMs === "number" && m.internalDateMs > 0) return m.internalDateMs;
  if (m.date) {
    const t = new Date(m.date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Phase 1: same Gmail thread only — no subject or AI fallback. */
function threadsMatch(
  message: InboxMessageForWaitingDetect,
  record: EmailCompletionRecord,
): boolean {
  const msgThread = message.threadId?.trim();
  const recordThread = record.threadId?.trim();
  if (!msgThread || !recordThread) return false;
  return msgThread === recordThread;
}

function isInboundThreadReply(
  message: InboxMessageForWaitingDetect,
  record: EmailCompletionRecord,
  startedAt: number,
  userEmail?: string | null,
): boolean {
  if (message.id === record.emailId) return false;
  const ms = messageMs(message);
  if (ms <= startedAt) return false;
  if (!threadsMatch(message, record)) return false;
  if (isSenderUser(message.sender, userEmail)) return false;
  return true;
}

/** Find the newest inbound reply in the same thread as an active waiting item. */
export function detectWaitingResponse(
  record: EmailCompletionRecord,
  messages: InboxMessageForWaitingDetect[],
  options?: WaitingDetectOptions,
): WaitingResponseDetection | null {
  if (!isActiveWaiting(record)) return null;
  if (record.waitingResponseDetectedAt && record.waitingResponseEmailId) return null;
  if (!record.threadId?.trim()) return null;

  const startedAt = record.stillWaitingAt ?? record.completedAt;
  const candidates = messages.filter((m) =>
    isInboundThreadReply(m, record, startedAt, options?.userEmail),
  );
  if (!candidates.length) return null;

  const best = [...candidates].sort((a, b) => messageMs(b) - messageMs(a))[0];
  return {
    responseEmailId: best.id,
    responseSender: best.sender,
    responseSubject: best.subject,
    responseSnippet: best.snippet,
    responseAt: messageMs(best),
    threadId: best.threadId ?? record.threadId!,
  };
}

export function scanWaitingResponseDetections(
  waitingRecords: EmailCompletionRecord[],
  messages: InboxMessageForWaitingDetect[],
  options?: WaitingDetectOptions,
): Array<{ waitingEmailId: string; detection: WaitingResponseDetection }> {
  const out: Array<{ waitingEmailId: string; detection: WaitingResponseDetection }> = [];

  for (const record of waitingRecords) {
    if (record.waitingResponseDetectedAt) continue;
    const detection = detectWaitingResponse(record, messages, options);
    if (detection) {
      out.push({ waitingEmailId: record.emailId, detection });
    }
  }

  return out;
}
