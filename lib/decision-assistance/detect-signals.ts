import { analyzeEmailIntent } from "@/lib/email-intent";
import { buildCalendarAwareness } from "@/lib/calendar-awareness";
import { detectStalledSignals } from "@/lib/follow-up/smart-engine/detect-stalled";
import { extractTaskAwareness } from "@/lib/action-intelligence/task-awareness";
import type { DecisionAwarenessKind } from "@/lib/decision-assistance/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { TimelineIntelligenceResult } from "@/lib/timeline-intelligence/types";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export type DetectedDecisionSignal = {
  kind: DecisionAwarenessKind;
  strength: number;
  reason: string;
};

const FINANCIAL =
  /\b(invoice|payment|billing|refund|charge|fattura|pagamento|wire|purchase order)\b/i;
const INTERVIEW = /\b(interview|opportunity to join|role at|hiring)\b/i;

export function detectDecisionSignals(input: {
  row: GmailInboxRow;
  category: InboxAiCategory;
  extraBody?: string;
  followUp?: FollowUpAnalysis | null;
  timeline?: TimelineIntelligenceResult | null;
  relationship?: SenderRelationshipProfile | null;
}): DetectedDecisionSignal[] {
  const hay = `${input.row.sender} ${input.row.subject} ${input.row.snippet} ${input.extraBody ?? ""}`;
  const intent = analyzeEmailIntent(input.row);
  const calendar = buildCalendarAwareness(input.row, input.extraBody);
  const stalled = detectStalledSignals(input.row, input.category);
  const tasks = extractTaskAwareness(input.row, input.extraBody);
  const signals: DetectedDecisionSignal[] = [];

  if (FINANCIAL.test(hay) || stalled.pendingPayment) {
    signals.push({
      kind: "financial_request",
      strength: stalled.pendingPayment ? 85 : 70,
      reason: "payment_or_invoice",
    });
  }

  if (
    calendar.schedulingIntent.detected &&
    (calendar.needsCalendarContext || /conflict|overlap|double.?book/i.test(hay))
  ) {
    signals.push({
      kind: "scheduling_conflict",
      strength: calendar.needsCalendarContext ? 65 : 50,
      reason: "scheduling_needs_review",
    });
  } else if (calendar.schedulingIntent.detected) {
    signals.push({
      kind: "scheduling_conflict",
      strength: 45,
      reason: "scheduling_intent",
    });
  }

  if (stalled.pendingApproval || intent.kinds.includes("decision_required")) {
    signals.push({
      kind: "unresolved_approval",
      strength: 78,
      reason: "approval_pending",
    });
  }

  if (
    (input.timeline?.escalationScore ?? 0) >= 50 ||
    input.timeline?.trajectory === "escalating" ||
    input.timeline?.trajectory === "frustrated"
  ) {
    signals.push({
      kind: "escalating_conversation",
      strength: Math.min(95, (input.timeline?.escalationScore ?? 55) + 10),
      reason: "escalation_detected",
    });
  }

  if (
    intent.kinds.includes("pricing_inquiry") ||
    intent.kinds.includes("sales_lead") ||
    intent.kinds.includes("partnership")
  ) {
    signals.push({
      kind: "business_opportunity",
      strength: 72 + intent.confidence * 15,
      reason: intent.kinds.join(","),
    });
  }

  if (INTERVIEW.test(hay)) {
    signals.push({
      kind: "business_opportunity",
      strength: 68,
      reason: "interview_opportunity",
    });
  }

  if (intent.kinds.includes("scheduling") || calendar.schedulingIntent.detected) {
    signals.push({
      kind: "business_opportunity",
      strength: 55,
      reason: "meeting_invitation",
    });
  }

  const hasDeadline =
    intent.kinds.includes("deadline") ||
    tasks.some((t) => t.kind === "date") ||
    /\b(deadline|by friday|by tomorrow|due)\b/i.test(hay);

  if (hasDeadline) {
    signals.push({
      kind: "deadline_approaching",
      strength: 75,
      reason: "deadline_mentioned",
    });
  }

  const vip =
    input.relationship?.importance === "vip" ||
    input.relationship?.kind === "vip_client";

  if (
    vip &&
    (input.followUp?.state === "awaiting_your_reply" ||
      input.followUp?.state === "waiting_for_response")
  ) {
    signals.push({
      kind: "potential_risk",
      strength: 80,
      reason: "vip_thread_open",
    });
  }

  if (input.followUp?.atRiskOfForgotten) {
    signals.push({
      kind: "potential_risk",
      strength: 72,
      reason: "at_risk_forgotten",
    });
  }

  if (
    (input.timeline?.threadMemory.followUpCount ?? 0) >= 2 ||
    input.timeline?.progression.repeatedFollowUps
  ) {
    signals.push({
      kind: "potential_risk",
      strength: 68,
      reason: "repeated_follow_ups",
    });
  }

  if (
    input.followUp?.state === "awaiting_your_reply" &&
    (input.followUp.daysSinceMessage ?? 0) >= 3
  ) {
    signals.push({
      kind: "potential_risk",
      strength: 65,
      reason: "unanswered_important",
    });
  }

  if (calendar.schedulingIntent.detected && /confirm|confirmation/i.test(hay)) {
    signals.push({
      kind: "potential_risk",
      strength: 58,
      reason: "missed_confirmation",
    });
  }

  return signals;
}
