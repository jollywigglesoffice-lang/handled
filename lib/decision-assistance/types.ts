import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** What Handled noticed — not a decision. */
export type DecisionAwarenessKind =
  | "financial_request"
  | "scheduling_conflict"
  | "unresolved_approval"
  | "escalating_conversation"
  | "business_opportunity"
  | "potential_risk"
  | "deadline_approaching";

export type DecisionConfidenceLevel =
  | "high_confidence"
  | "possible_concern"
  | "low_suggestion";

export type DecisionInsight = {
  id: string;
  kind: DecisionAwarenessKind;
  /** “Why this matters” — calm, specific */
  whyItMatters: string;
  confidence: DecisionConfidenceLevel;
  calmDetail?: string;
};

export type DecisionOpportunity = {
  id: string;
  label: string;
  message: string;
  confidence: DecisionConfidenceLevel;
};

export type DecisionRisk = {
  id: string;
  label: string;
  message: string;
  confidence: DecisionConfidenceLevel;
};

export type DecisionAssistanceResult = {
  active: boolean;
  /** User always decides — never auto-act */
  userMustDecide: true;
  primaryConfidence: DecisionConfidenceLevel;
  insights: DecisionInsight[];
  opportunities: DecisionOpportunity[];
  risks: DecisionRisk[];
  awarenessKinds: DecisionAwarenessKind[];
};

export type AnalyzeDecisionAssistanceInput = {
  row: {
    id: string;
    threadId?: string;
    sender: string;
    subject: string;
    snippet: string;
    internalDateMs: number;
    category?: InboxAiCategory;
  };
  extraBody?: string;
  locale?: "en" | "it";
  senderRelationships?: import("@/lib/relationship-intelligence/types").SenderRelationship[];
};

export type DecisionAssistanceIntegrationId =
  | "decision_memory"
  | "strategic_insights"
  | "operational_coaching"
  | "personal_assistant"
  | "executive_assistant";

export type DecisionAssistanceIntegrationDescriptor = {
  id: DecisionAssistanceIntegrationId;
  status: "available" | "planned" | "connected";
  description: string;
};
