import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { isActiveWaiting } from "@/lib/waiting-on/helpers";
import { senderMatchesWaitingTarget } from "@/lib/waiting-on/match-sender";

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

function messageMs(m: InboxMessageForWaitingDetect): number {
  if (typeof m.internalDateMs === "number" && m.internalDateMs > 0) return m.internalDateMs;
  if (m.date) {
    const t = new Date(m.date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(re|fwd|fw):\s*/gi, "").trim().toLowerCase();
}

function threadsMatch(
  message: InboxMessageForWaitingDetect,
  record: EmailCompletionRecord,
): boolean {
  const msgThread = message.threadId ?? message.id;
  const recordThread = record.threadId ?? record.emailId;
  if (msgThread === recordThread) return true;

  const msgSubj = normalizeSubject(message.subject);
  const recordSubj = normalizeSubject(record.subject);
  if (msgSubj && recordSubj && msgSubj === recordSubj) return true;

  if (
    message.subject.toLowerCase().startsWith("re:") &&
    recordSubj &&
    normalizeSubject(message.subject) === recordSubj
  ) {
    return true;
  }

  return false;
}

function isReplyFromWaitingParty(
  message: InboxMessageForWaitingDetect,
  record: EmailCompletionRecord,
  startedAt: number,
): boolean {
  if (message.id === record.emailId) return false;
  const ms = messageMs(message);
  if (ms <= startedAt) return false;
  if (!senderMatchesWaitingTarget(message.sender, record)) return false;
  if (!threadsMatch(message, record)) return false;
  return true;
}

/** Find the newest inbox reply to an active waiting item. */
export function detectWaitingResponse(
  record: EmailCompletionRecord,
  messages: InboxMessageForWaitingDetect[],
): WaitingResponseDetection | null {
  if (!isActiveWaiting(record)) return null;
  if (record.waitingResponseDetectedAt && record.waitingResponseEmailId) return null;

  const startedAt = record.stillWaitingAt ?? record.completedAt;
  const candidates = messages.filter((m) => isReplyFromWaitingParty(m, record, startedAt));
  if (!candidates.length) return null;

  const best = [...candidates].sort((a, b) => messageMs(b) - messageMs(a))[0];
  return {
    responseEmailId: best.id,
    responseSender: best.sender,
    responseSubject: best.subject,
    responseSnippet: best.snippet,
    responseAt: messageMs(best),
    threadId: best.threadId ?? best.id,
  };
}

export function scanWaitingResponseDetections(
  waitingRecords: EmailCompletionRecord[],
  messages: InboxMessageForWaitingDetect[],
): Array<{ waitingEmailId: string; detection: WaitingResponseDetection }> {
  const out: Array<{ waitingEmailId: string; detection: WaitingResponseDetection }> = [];

  for (const record of waitingRecords) {
    if (record.waitingResponseDetectedAt) continue;
    const detection = detectWaitingResponse(record, messages);
    if (detection) {
      out.push({ waitingEmailId: record.emailId, detection });
    }
  }

  return out;
}
