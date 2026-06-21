import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import { resolveSenderRelationship } from "@/lib/relationship-intelligence/resolve";
import { analyzeTimelineIntelligence } from "@/lib/timeline-intelligence";
import { toThreadSnapshot } from "@/lib/timeline-intelligence/thread-group";
import { detectDecisionSignals } from "@/lib/decision-assistance/detect-signals";
import {
  buildDecisionInsights,
  buildOpportunities,
  buildRisks,
} from "@/lib/decision-assistance/insights";
import type {
  AnalyzeDecisionAssistanceInput,
  DecisionAssistanceResult,
  DecisionConfidenceLevel,
} from "@/lib/decision-assistance/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

function primaryConfidence(
  insights: { confidence: DecisionConfidenceLevel }[],
  risks: { confidence: DecisionConfidenceLevel }[],
): DecisionConfidenceLevel {
  const all = [...insights, ...risks];
  if (all.some((x) => x.confidence === "high_confidence")) return "high_confidence";
  if (all.some((x) => x.confidence === "possible_concern")) return "possible_concern";
  return "low_suggestion";
}

export function analyzeDecisionAssistance(
  input: AnalyzeDecisionAssistanceInput,
): DecisionAssistanceResult {
  const locale = input.locale ?? "en";
  const category = (input.row.category ?? "worth_your_attention") as InboxAiCategory;
  const relationship = resolveSenderRelationship(
    input.row,
    category,
    input.senderRelationships ?? [],
  );

  const followUp = analyzeFollowUp(
    {
      id: input.row.id,
      threadId: input.row.threadId ?? input.row.id,
      sender: input.row.sender,
      subject: input.row.subject,
      snippet: input.row.snippet,
      date: "",
      internalDateMs: input.row.internalDateMs,
    },
    category,
    { senderRelationships: input.senderRelationships },
  );

  const timeline = analyzeTimelineIntelligence({
    row: toThreadSnapshot({
      ...input.row,
      threadId: input.row.threadId ?? input.row.id,
      category,
    }),
    extraBody: input.extraBody,
    locale,
  });

  const signals = detectDecisionSignals({
    row: {
      id: input.row.id,
      threadId: input.row.threadId ?? input.row.id,
      sender: input.row.sender,
      subject: input.row.subject,
      snippet: input.row.snippet,
      date: "",
      internalDateMs: input.row.internalDateMs,
    },
    category,
    extraBody: input.extraBody,
    followUp,
    timeline: timeline.active ? timeline : null,
    relationship,
  });

  const insights = buildDecisionInsights(signals, {
    sender: input.row.sender,
    locale,
  });
  const opportunities = buildOpportunities(signals, locale);
  const risks = buildRisks(signals, locale);

  const active =
    insights.length > 0 ||
    opportunities.length > 0 ||
    risks.length > 0;

  return {
    active,
    userMustDecide: true,
    primaryConfidence: primaryConfidence(insights, risks),
    insights,
    opportunities,
    risks,
    awarenessKinds: [...new Set(signals.map((s) => s.kind))],
  };
}

export function formatDecisionAssistanceForPrompt(
  result: DecisionAssistanceResult,
): string {
  if (!result.active) return "";
  const lines = result.insights.slice(0, 2).map((i) => `- ${i.whyItMatters}`);
  const opp = result.opportunities[0]?.message;
  const risk = result.risks[0]?.message;
  return `Decision assistance (guidance only — user decides all actions):\n${lines.join("\n")}${opp ? `\nOpportunity: ${opp}` : ""}${risk ? `\nRisk note: ${risk}` : ""}\nNever decide or send on the user's behalf.`;
}
