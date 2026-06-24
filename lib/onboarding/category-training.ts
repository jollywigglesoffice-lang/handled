import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { scopedEmailKey } from "@/lib/gmail/account-types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { resolveSenderIdentity } from "@/lib/sender-identity";

export type TrainingClassifications = {
  emails: Record<string, InboxAiCategory>;
  senders: Record<string, InboxAiCategory>;
};

export const TRAINING_PAGE_SIZE = 5;

export function emptyTrainingClassifications(): TrainingClassifications {
  return { emails: {}, senders: {} };
}

export function senderTrainingKey(sender: string): string {
  return resolveSenderIdentity(sender).ruleKey;
}

export function emailTrainingKey(message: Pick<GmailCardMessage, "id" | "accountId">): string {
  return scopedEmailKey(message.id, message.accountId);
}

export function isMessageClassified(
  message: GmailCardMessage,
  classifications: TrainingClassifications,
): boolean {
  const emailKey = emailTrainingKey(message);
  if (classifications.emails[emailKey]) return true;
  const senderKey = senderTrainingKey(message.sender);
  return Boolean(classifications.senders[senderKey]);
}

export function countUnclassified(
  messages: GmailCardMessage[],
  classifications: TrainingClassifications,
  isCompleted: (id: string) => boolean,
): number {
  return messages.filter(
    (message) => !isCompleted(message.id) && !isMessageClassified(message, classifications),
  ).length;
}

export function getUnclassifiedPool(
  messages: GmailCardMessage[],
  classifications: TrainingClassifications,
  isCompleted: (id: string) => boolean,
): GmailCardMessage[] {
  return messages.filter(
    (message) => !isCompleted(message.id) && !isMessageClassified(message, classifications),
  );
}

export function pickTrainingExamples(
  messages: GmailCardMessage[],
  classifications: TrainingClassifications,
  opts: {
    isCompleted: (id: string) => boolean;
    refreshIndex: number;
    pageSize?: number;
  },
): GmailCardMessage[] {
  const pool = getUnclassifiedPool(messages, classifications, opts.isCompleted);
  if (pool.length === 0) return [];

  const pageSize = opts.pageSize ?? TRAINING_PAGE_SIZE;
  const bySender = new Map<string, GmailCardMessage>();
  for (const message of pool) {
    const key = senderTrainingKey(message.sender);
    if (!bySender.has(key)) bySender.set(key, message);
  }

  const deduped = [...bySender.values()];
  const start = (opts.refreshIndex * pageSize) % deduped.length;

  const result: GmailCardMessage[] = [];
  for (let i = 0; i < pageSize && i < deduped.length; i++) {
    result.push(deduped[(start + i) % deduped.length]!);
  }
  return result;
}

/** Heuristic-only hint from API — never treated as assigned category. */
export function getTrainingHint(message: GmailCardMessage): InboxAiCategory | null {
  return message.trainingHint ?? null;
}

export function applyTrainingClassification(
  classifications: TrainingClassifications,
  message: GmailCardMessage,
  category: InboxAiCategory,
): TrainingClassifications {
  const emailKey = emailTrainingKey(message);
  const senderKey = senderTrainingKey(message.sender);
  return {
    emails: { ...classifications.emails, [emailKey]: category },
    senders: { ...classifications.senders, [senderKey]: category },
  };
}

export function countClassificationsForCategory(
  classifications: TrainingClassifications,
  category: InboxAiCategory,
): number {
  const senderCount = Object.values(classifications.senders).filter((c) => c === category).length;
  const emailOnlyCount = Object.entries(classifications.emails).filter(([, c]) => c === category)
    .length;
  return Math.max(senderCount, emailOnlyCount);
}
