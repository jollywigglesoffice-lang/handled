import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Internal reason codes (logged / API metadata — not shown in UI yet). */
export type CategorizationReasonCode =
  | "school_context"
  | "family_context"
  | "healthcare_context"
  | "scheduling_intent"
  | "scheduling_change"
  | "question_detected"
  | "request_detected"
  | "deadline_detected"
  | "invoice_in_personal_context"
  | "italian_urgency"
  | "english_urgency"
  | "known_high_priority_sender"
  | "known_low_priority_sender"
  | "relationship_school"
  | "relationship_family"
  | "relationship_healthcare"
  | "relationship_vip"
  | "work_management"
  | "meeting_request"
  | "mixed_signals"
  | "ambiguous_unknown_sender"
  | "safety_worth_your_attention"
  | "personal_name_sender"
  | "promotional_bulk"
  | "marketing_urgency_filtered"
  | "newsletter_detected";

export type CategorizationIntelligenceResult = {
  suggestedCategory: InboxAiCategory;
  /** 0–1 — lower when ambiguous or mixed signals */
  confidence: number;
  /** 0–100 real-human urgency score */
  priorityScore: number;
  /** 0–100 promotional/marketing score */
  promotionalScore: number;
  /** 0–100 genuine human/school/family score */
  realHumanScore: number;
  reasonCodes: CategorizationReasonCode[];
  reasonLabels: string[];
  /** When true, never assign handled / promotion / newsletter */
  blockLowPriorityCategories: boolean;
  /** When true, bias finalize toward worth_your_attention */
  forceNeedsAttention: boolean;
  /** When true, classify as promotion/newsletter and skip urgency escalation */
  forcePromotional: boolean;
};

export type CategorizationIntelligenceOptions = {
  senderRules?: Array<{ senderEmail?: string; senderDomain?: string; targetCategory: InboxAiCategory }>;
  relationshipKind?: string | null;
  relationshipImportance?: string | null;
};
