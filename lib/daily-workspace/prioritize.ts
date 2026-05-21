import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { ActionIntelligenceResult } from "@/lib/action-intelligence/types";
import type { ReplyNeedAssessment } from "@/lib/reply-necessity";
import type { DailyWorkspaceMessage } from "@/lib/daily-workspace/types";

const SCHOOL_FAMILY = /school|teacher|family|scuola|insegnante|genitori/i;
const BUSINESS = /pricing|enterprise|invoice|partnership|demo|client/i;

export type PrioritySignals = {
  followUp?: FollowUpAnalysis | null;
  replyNeed?: ReplyNeedAssessment;
  action?: ActionIntelligenceResult;
  daysSince: number;
};

export function scoreWorkspacePriority(
  m: DailyWorkspaceMessage,
  signals: PrioritySignals,
): number {
  let score = 30;

  if (m.category === "needs_attention") score += 18;
  if (m.category === "quick_reply") score += 10;
  if (m.category === "handled" || m.category === "newsletter" || m.category === "promotion") {
    score -= 25;
  }

  const hay = `${m.sender} ${m.subject} ${m.snippet}`;

  if (m.relationship?.importance === "vip" || m.relationship?.kind === "vip_client") {
    score += 22;
  } else if (m.relationship?.importance === "important") {
    score += 12;
  }

  if (m.relationship?.kind === "school" || m.relationship?.kind === "family") {
    score += 16;
  } else if (SCHOOL_FAMILY.test(hay)) {
    score += 10;
  }

  if (BUSINESS.test(hay)) score += 8;

  if (signals.followUp) {
    score += signals.followUp.urgencyScore * 0.45;
    if (signals.followUp.atRiskOfForgotten) score += 12;
  }

  if (signals.replyNeed?.recommended) {
    score += 14 + (signals.replyNeed.confidence ?? 0) * 10;
  }

  if (signals.action?.actionable) {
    score += 10 + (signals.action.confidence ?? 0) * 8;
    if (signals.action.primaryLabel === "urgent") score += 15;
    if (signals.action.primaryLabel === "deadline") score += 12;
    if (signals.action.primaryLabel === "payment") score += 10;
  }

  if (signals.daysSince >= 5 && signals.daysSince <= 21) score += 6;
  if (signals.daysSince > 21) score -= 4;

  if (m.needsCalendarContext) score += 8;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** Minimum score to surface in Today's Focus */
export const FOCUS_MIN_SCORE = 48;

/** Minimum for Waiting On */
export const WAITING_MIN_SCORE = 40;
