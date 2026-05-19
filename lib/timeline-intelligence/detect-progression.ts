import type {
  ConversationProgression,
  ThreadMessageSnapshot,
} from "@/lib/timeline-intelligence/types";
import { countFollowUpsInHay } from "@/lib/timeline-intelligence/thread-memory";

export function analyzeConversationProgression(input: {
  row: ThreadMessageSnapshot;
  hay: string;
  threadMessages: ThreadMessageSnapshot[];
  escalationScore: number;
  daysSinceLatest: number;
}): ConversationProgression {
  const siblings = input.threadMessages.filter(
    (m) => m.threadId === input.row.threadId && m.id !== input.row.id,
  );

  const allInThread = [input.row, ...siblings].sort(
    (a, b) => a.internalDateMs - b.internalDateMs,
  );

  const combinedHay = allInThread
    .map((m) => `${m.subject} ${m.snippet}`)
    .join(" ")
    .toLowerCase();

  const followUpCount = countFollowUpsInHay(combinedHay);
  const repeatedFollowUps = followUpCount >= 2 || input.escalationScore >= 25;

  let threadSpanDays = input.daysSinceLatest;
  if (allInThread.length >= 2) {
    const oldest = allInThread[0]!.internalDateMs;
    const newest = allInThread[allInThread.length - 1]!.internalDateMs;
    threadSpanDays = Math.max(
      0,
      Math.floor((newest - oldest) / (24 * 60 * 60 * 1000)),
    );
  }

  const longRunning = threadSpanDays >= 7 || allInThread.length >= 3;

  const pendingRequest =
    /\b(please|can you|could you|need your|waiting for|pending)\b/i.test(input.hay) ||
    /\bawaiting\b/i.test(input.hay);

  const unresolvedThread =
    pendingRequest ||
    repeatedFollowUps ||
    input.daysSinceLatest >= 3;

  return {
    repeatedFollowUps,
    escalatingUrgency: input.escalationScore >= 35,
    unresolvedThread,
    pendingRequest,
    longRunning,
    threadSpanDays,
  };
}
