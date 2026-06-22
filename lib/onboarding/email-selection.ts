import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { buildFirstTimeOnboardingQueue } from "@/lib/onboarding/build-queue";
import {
  derivePresencePatterns,
  pickPresenceOnboardingEmail,
  resolvePresenceAdjustments,
} from "@/lib/presence";

export type OnboardingEmailSelectionState = {
  emailId: string | null;
  accountId?: string;
  pickIndex: number;
  refreshIndex: number;
};

export function resolveOnboardingEmailById(
  pool: GmailCardMessage[],
  emailId: string | null,
  accountId?: string,
): GmailCardMessage | null {
  if (!emailId) return null;
  return (
    pool.find((m) => m.id === emailId && m.accountId === accountId) ??
    pool.find((m) => m.id === emailId) ??
    null
  );
}

/** Initial pick — runs once when entering Step 3, not on pool updates. */
export function pickInitialOnboardingEmail(
  messages: GmailCardMessage[],
  isCompleted: (id: string) => boolean,
  refreshIndex = 0,
): { email: GmailCardMessage | null; pickIndex: number; queue: GmailCardMessage[] } {
  const queue = buildFirstTimeOnboardingQueue(messages, isCompleted, { refreshIndex });
  if (queue.length === 0) {
    return { email: null, pickIndex: 0, queue };
  }

  const preferred = pickPresenceOnboardingEmail(
    queue,
    resolvePresenceAdjustments(derivePresencePatterns()),
  );
  const email = preferred ?? queue[0] ?? null;
  const pickIndex = email ? Math.max(0, queue.findIndex((m) => m.id === email.id)) : 0;
  return { email, pickIndex, queue };
}

export function pickNextOnboardingEmail(input: {
  currentEmailId: string | null;
  pickIndex: number;
  refreshIndex: number;
  queue: GmailCardMessage[];
  messages: GmailCardMessage[];
  isCompleted: (id: string) => boolean;
}): {
  email: GmailCardMessage | null;
  pickIndex: number;
  refreshIndex: number;
} {
  const nextIndex = input.pickIndex + 1;
  if (nextIndex < input.queue.length) {
    const email = input.queue[nextIndex] ?? null;
    return { email, pickIndex: nextIndex, refreshIndex: input.refreshIndex };
  }

  const refreshIndex = input.refreshIndex + 1;
  const rotatedQueue = buildFirstTimeOnboardingQueue(input.messages, input.isCompleted, {
    refreshIndex,
  });
  const email =
    rotatedQueue.find((m) => m.id !== input.currentEmailId) ?? rotatedQueue[0] ?? null;
  return { email, pickIndex: 0, refreshIndex };
}
