import type { ConversationStatus } from "@/lib/timeline-intelligence/types";
import type { ConversationProgression } from "@/lib/timeline-intelligence/types";
import type { EmotionalTrajectory } from "@/lib/timeline-intelligence/types";

export function resolveConversationStatus(input: {
  progression: ConversationProgression;
  trajectory: EmotionalTrajectory;
  escalationScore: number;
  daysSinceLatest: number;
  waitingOnOther: boolean;
  awaitingUser: boolean;
  likelyResolved: boolean;
}): ConversationStatus {
  if (input.likelyResolved) return "resolved";

  if (input.progression.escalatingUrgency || input.trajectory === "escalating") {
    return "escalating";
  }

  if (input.awaitingUser) return "needs_follow_up";

  if (input.waitingOnOther || input.progression.unresolvedThread) {
    if (input.daysSinceLatest >= 5) return "stalled";
    return "waiting";
  }

  if (input.progression.repeatedFollowUps || input.progression.pendingRequest) {
    return "needs_follow_up";
  }

  if (input.progression.longRunning && input.daysSinceLatest >= 3) {
    return "stalled";
  }

  return "open";
}
