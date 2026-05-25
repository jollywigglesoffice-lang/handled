import { detectEscalation } from "@/lib/timeline-intelligence/detect-escalation";
import { detectEmotionalTrajectory } from "@/lib/timeline-intelligence/detect-emotional-trajectory";
import { analyzeConversationProgression } from "@/lib/timeline-intelligence/detect-progression";
import { resolveConversationStatus } from "@/lib/timeline-intelligence/conversation-status";
import { humanizeTimelineSummary } from "@/lib/continuity-context";
import { buildTimelineSummary } from "@/lib/timeline-intelligence/timeline-summary";
import {
  countFollowUpsInHay,
  extractThreadMemory,
  inferReplyHeuristics,
} from "@/lib/timeline-intelligence/thread-memory";
import { siblingsInThread } from "@/lib/timeline-intelligence/thread-group";
import type {
  AnalyzeTimelineInput,
  TimelineIntelligenceResult,
  TimelineIntelligenceSummary,
} from "@/lib/timeline-intelligence/types";
import { senderFirstNameFromRow } from "@/lib/follow-up/format";

function daysSince(ms: number): number {
  if (!ms) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)));
}

const RESOLVED =
  /\b(thank you for your (?:order|purchase)|receipt|case closed|resolved|unsubscribe|no further action)\b/i;

const AWAITING_USER =
  /please (?:confirm|let me know|send|review|approve)|can you|could you|need your (?:reply|response)/i;

const WAITING_ON_OTHER =
  /following up|checking in|any update|haven'?t heard|still waiting|per my (?:last )?email/i;

export function analyzeTimelineIntelligence(
  input: AnalyzeTimelineInput,
): TimelineIntelligenceResult {
  const locale = input.locale ?? "en";
  const row = input.row;
  const hay = `${row.sender} ${row.subject} ${row.snippet} ${input.extraBody ?? ""}`.toLowerCase();
  const threadPool = input.threadMessages?.length
    ? input.threadMessages
    : siblingsInThread(row, [row]);

  const daysSinceLatest = daysSince(row.internalDateMs);
  const escalation = detectEscalation(hay, row.subject);
  const trajectory = detectEmotionalTrajectory(hay, escalation.score);

  const memoryBase = extractThreadMemory(hay);
  const replyHeuristics = inferReplyHeuristics(hay);
  const combinedHay = threadPool.map((m) => `${m.subject} ${m.snippet}`).join(" ");

  const threadMemory = {
    ...memoryBase,
    ...replyHeuristics,
    followUpCount: Math.max(
      countFollowUpsInHay(hay),
      countFollowUpsInHay(combinedHay),
      escalation.followUpOrdinal ?? 0,
    ),
  };

  const progression = analyzeConversationProgression({
    row,
    hay,
    threadMessages: threadPool,
    escalationScore: escalation.score,
    daysSinceLatest,
  });

  const awaitingUser = AWAITING_USER.test(hay);
  const waitingOnOther =
    WAITING_ON_OTHER.test(hay) || replyHeuristics.otherRepliedHeuristic;
  const likelyResolved =
    RESOLVED.test(hay) &&
    !awaitingUser &&
    escalation.score < 20 &&
    row.category === "handled";

  const conversationStatus = resolveConversationStatus({
    progression,
    trajectory,
    escalationScore: escalation.score,
    daysSinceLatest,
    waitingOnOther,
    awaitingUser,
    likelyResolved,
  });

  const senderLabel = senderFirstNameFromRow(row.sender);
  const built = buildTimelineSummary({
    status: conversationStatus,
    daysSinceLatest,
    memory: threadMemory,
    progression,
    escalationOrdinal: escalation.followUpOrdinal,
    senderLabel,
    locale,
  });

  const visibilityBoost = Math.min(
    25,
    Math.round(escalation.score * 0.2) +
      (progression.repeatedFollowUps ? 6 : 0) +
      (progression.longRunning ? 4 : 0) +
      (conversationStatus === "escalating" ? 8 : 0) +
      (conversationStatus === "stalled" ? 5 : 0),
  );

  const active =
    !likelyResolved &&
    (escalation.score >= 15 ||
      progression.unresolvedThread ||
      progression.repeatedFollowUps ||
      daysSinceLatest >= 2 ||
      conversationStatus !== "open");

  const result: TimelineIntelligenceResult = {
    active,
    conversationStatus,
    trajectory,
    escalationScore: escalation.score,
    timelineSummary: built.primary,
    calmDetail: built.detail,
    threadMemory,
    progression,
    visibilityBoost,
  };

  const human = humanizeTimelineSummary(result, {
    sender: row.sender,
    subject: row.subject,
    snippet: row.snippet,
    daysSinceMessage: daysSinceLatest,
    locale,
  });

  return {
    ...result,
    timelineSummary: human.primary,
    calmDetail: human.detail ?? result.calmDetail,
  };
}

export function summarizeTimelineIntelligence(
  result: TimelineIntelligenceResult,
): TimelineIntelligenceSummary {
  return {
    active: result.active,
    conversationStatus: result.conversationStatus,
    timelineSummary: result.timelineSummary,
    escalationScore: result.escalationScore,
  };
}

export function formatTimelineForPrompt(
  result: TimelineIntelligenceResult,
  locale: "en" | "it" = "en",
): string {
  if (!result.active) return "";
  const lines = [
    `Conversation timeline: ${result.timelineSummary}`,
    result.calmDetail ?? "",
    `Status: ${result.conversationStatus.replace(/_/g, " ")}`,
    `Tone trajectory: ${result.trajectory}`,
  ].filter(Boolean);
  if (result.threadMemory.requestedActions.length) {
    lines.push(
      `Prior requests: ${result.threadMemory.requestedActions.join("; ")}`,
    );
  }
  return lines.join("\n");
}
